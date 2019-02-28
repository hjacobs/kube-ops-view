package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type clientMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type clusterUpdateMessage struct {
	ID             string                  `json:"id"`
	Nodes          map[string]nodeWithPods `json:"nodes"`
	UnassignedPods []corev1.Pod            `json:"unassigned_pods"`
}

type nodeWithPods struct {
	corev1.Node
	Pods map[string]corev1.Pod `json:"pods"`
}

type clusterDeltaMessage struct {
	ClusterID string `json:"cluster_id"`
	// Delta can't be a concrete type in the current implementation
	Delta interface{} `json:"delta"`
}

var (
	connEventChans   map[chan *clientMessage]struct{}
	connEventChansMu sync.Mutex
)

type watchError struct {
	Object runtime.Object
}

func (w watchError) Error() string {
	return fmt.Sprintf("error from watch: %s", w.Object)
}

func main() {
	ctx := context.Background()
	clientsets := make(map[string]*kubernetes.Clientset)
	connEventChans = make(map[chan *clientMessage]struct{})
	for _, config := range getConfigs() {
		cli, err := kubernetes.NewForConfig(config)
		if err != nil {
			log.Printf("Unable to create client for config %s: %s", config.Host, err.Error())
			continue
		}
		clientsets[config.Host] = cli
	}
	if len(clientsets) == 0 {
		log.Fatalln("No clients available, see previous errors")
	}
	wsUpgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(_ *http.Request) bool { return true },
	}
	var assetPath string
	if assetPath = os.Getenv("ASSET_PATH"); assetPath == "" {
		assetPath = "static/"
	}
	log.Println("serving static assets from", assetPath)
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(assetPath)))
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("unable to upgrade for websocket:", err.Error())
			return
		}
		subCtx, cancel := context.WithCancel(ctx)
		conn.SetCloseHandler(func(_ int, _ string) error {
			cancel()
			return nil
		})
		eventChan := make(chan *clientMessage)
		// send initial cluster data
		for apiEndpoint, client := range clientsets {
			go func(endpoint string, cli *kubernetes.Clientset) {
				log.Println("getting cluster info for", endpoint)
				if data, err := getClusterData(endpoint, cli); err != nil {
					log.Printf("Unable to get initial cluster data for %s: %s", endpoint, err.Error())
				} else {
					eventChan <- &clientMessage{Type: "clusterupdate", Data: data}
				}
			}(apiEndpoint, client)
		}
		connEventChansMu.Lock()
		connEventChans[eventChan] = struct{}{}
		connEventChansMu.Unlock()
		go handleConn(subCtx, conn, eventChan)
	})
	log.Println("listening on :8081")
	http.ListenAndServe(":8081", mux)
}

func handleConn(ctx context.Context, conn *websocket.Conn, eventChan chan *clientMessage) {
	for {
		select {
		case <-ctx.Done():
			log.Println("got done from context")
			conn.Close()
			return
		case podEvent := <-eventChan:
			if err := conn.WriteJSON(podEvent); err != nil {
				log.Println("error writing to websocket:", err.Error())
				// we'll consider this fatal and return here
				return
			}
		}
	}
}

func getClusterData(apiEndpoint string, kubeClient *kubernetes.Clientset) (*clusterUpdateMessage, error) {
	nodesList, err := kubeClient.CoreV1().Nodes().List(metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	response := make(map[string]nodeWithPods, nodesList.Size())
	for _, node := range nodesList.Items {
		pods, err := kubeClient.CoreV1().Pods("").List(metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.nodeName=%s", node.Name),
		})
		if err != nil {
			log.Printf("error listing pods for node %s: %s", node.Name, err.Error())
		}
		podMap := make(map[string]corev1.Pod, pods.Size())
		for _, pod := range pods.Items {
			key := fmt.Sprintf("%s/%s", pod.Namespace, pod.Name)
			podMap[key] = pod
		}
		response[node.Name] = nodeWithPods{
			Node: node,
			Pods: podMap,
		}
	}
	return &clusterUpdateMessage{
		ID:             apiEndpoint,
		Nodes:          response,
		UnassignedPods: make([]corev1.Pod, 0),
	}, nil
}

func getConfigs() []*rest.Config {
	var configs []*rest.Config
	if c, err := rest.InClusterConfig(); err == nil {
		configs = append(configs, c)
	} else {
		log.Printf("Unable to read in-cluster config: %s\n", err.Error())
	}
	if kubeconfig := os.Getenv("KUBECONFIG"); kubeconfig != "" {
		configs = append(configs, handleKubeconfigVar(kubeconfig)...)
	}
	// kube-proxy based config
	if len(configs) == 0 {
		log.Println("No configs found, falling back to kube-proxy mode")
		c := &rest.Config{
			Host: "http://localhost:8001",
		}
		configs = append(configs, c)
	}
	return configs
}

func handleKubeconfigVar(kubeconfig string) []*rest.Config {
	var (
		candidates []string
		configs    []*rest.Config
	)
	for _, configCandidate := range strings.Split(kubeconfig, ":") {
		if stat, statErr := os.Stat(configCandidate); statErr == nil && stat.IsDir() {
			walkErr := filepath.Walk(configCandidate, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					log.Printf("error walking path %s: %s\n", path, err.Error())
					return nil
				} else if info.IsDir() {
					// we only go one subdir deep for now
					log.Printf("not walking subdir %s\n", path)
					return nil
				}
				candidates = append(candidates, path)
				return nil
			})
			if walkErr != nil {
				log.Printf("Unable to walk path %s: %s", configCandidate, walkErr.Error())
			}
		} else if statErr == nil {
			candidates = append(candidates, configCandidate)
		} else {
			log.Printf("unable to read config candidate %s: %s\n", configCandidate, statErr.Error())
		}
	}
	for _, configFile := range candidates {
		if bytes, readErr := ioutil.ReadFile(configFile); readErr != nil {
			log.Printf("Unable to read config file %s: %s", configFile, readErr.Error())
		} else {
			if config, parseErr := clientcmd.NewClientConfigFromBytes(bytes); parseErr != nil {
				log.Printf("Unable to parse config %s: %s\n", configFile, parseErr.Error())
			} else {
				if clientConfig, err := config.ClientConfig(); err != nil {
					log.Printf("Unable to get rest client config for %s: %s", configFile, err.Error())
				} else {
					log.Printf("successfully loaded config for %s\n", clientConfig.Host)
					configs = append(configs, clientConfig)
				}
			}
		}
	}
	return configs
}

func startWatch(ctx context.Context, apiEndpoint string, cli *kubernetes.Clientset) {
	// TODO: Can this be less heavy?
	pods, err := cli.CoreV1().Pods("").List(metav1.ListOptions{})
	if err != nil {
		log.Printf("Error listing pods for %s: %s\n", apiEndpoint, err.Error())
		return
	}
	watcher, err := cli.CoreV1().Pods("").Watch(metav1.ListOptions{
		ResourceVersion: pods.ListMeta.ResourceVersion,
	})
	if err != nil {
		log.Printf("Unable to start watch for %s: %s\n", apiEndpoint, err.Error())
		return
	}
	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Println("Context closed, stopping watch for", apiEndpoint)
				watcher.Stop()
				return
			case e := <-watcher.ResultChan():
				message, err := constructDeltaMessage(apiEndpoint, e)
				if err != nil {
					log.Printf("Error from watch: %s", err.Error())
				}
				for c := range connEventChans {
					c <- message
				}
			}
		}
	}()
}

func constructDeltaMessage(apiEndpoint string, podEvent watch.Event) (*clientMessage, error) {
	log.Println("got new event from watch, type:", podEvent.Type)
	if podEvent.Type == watch.Error {
		return nil, watchError{Object: podEvent.Object}
	}
	pod, ok := podEvent.Object.(*corev1.Pod)
	log.Println("got event for pod:", pod.Name)
	if !ok {
		log.Println("got non-pod type in event:", podEvent.Object.GetObjectKind().GroupVersionKind())
		return nil, nil
	}
	response := make([]interface{}, 0, 2)
	if pod.Spec.NodeName == "" {
		response = append(response,
			[]string{
				"unassigned_pods",
				fmt.Sprintf("%s/%s", pod.ObjectMeta.Namespace, pod.ObjectMeta.Name),
			},
		)
	} else {
		response = append(
			response,
			[]string{
				"nodes",
				pod.Spec.NodeName,
				"pods",
				fmt.Sprintf("%s/%s", pod.ObjectMeta.Namespace, pod.ObjectMeta.Name),
			},
		)
	}
	if podEvent.Type == watch.Added || podEvent.Type == watch.Modified {
		response = append(response, pod)
	}
	return &clientMessage{
		Type: "clusterdelta",
		Data: clusterDeltaMessage{ClusterID: apiEndpoint, Delta: []interface{}{response}},
	}, nil
}

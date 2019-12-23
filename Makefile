.PHONY: clean test appjs docker push mock

IMAGE            ?= hjacobs/kube-ops-view
VERSION          ?= $(shell git describe --tags --always --dirty)
TAG              ?= $(VERSION)
TTYFLAGS         = $(shell test -t 0 && echo "-it")

default: docker

.PHONY: install
install:
	poetry install

clean:
	rm -fr kube_ops_view/static/build

test: install
	poetry run flake8
	poetry run black --check kube_ops_view
	# poetry run mypy --ignore-missing-imports kube_ops_view
	poetry run coverage run --source=kube_ops_view -m py.test -v
	poetry run coverage report

appjs:
	docker run $(TTYFLAGS) -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app -e NPM_CONFIG_CACHE=/tmp node:11.10-alpine npm install
	docker run $(TTYFLAGS) -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app -e NPM_CONFIG_CACHE=/tmp node:11.10-alpine npm run build

docker: appjs
	docker build --build-arg "VERSION=$(VERSION)" -t "$(IMAGE):$(TAG)" .
	@echo 'Docker image $(IMAGE):$(TAG) can now be used.'

docker-arm: appjs
	docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
	docker buildx create --name arm-node --append --use --platform "linux/arm"
	docker buildx build --build-arg "VERSION=$(VERSION)" --platform "linux/arm" -t $(IMAGE):$(TAG) --load .
	@echo 'Docker image $(IMAGE):$(TAG) can now be used.'

push: docker
	docker push "$(IMAGE):$(TAG)"
	docker tag "$(IMAGE):$(TAG)" "$(IMAGE):latest"
	docker push "$(IMAGE):latest"

mock:
	docker run $(TTYFLAGS) -p 8080:8080 "$(IMAGE):$(TAG)" --mock \
		--node-link-url-template "https://kube-web-view.example.org/clusters/{cluster}/nodes/{name}" \
		--pod-link-url-template "https://kube-web-view.example.org/clusters/{cluster}/namespaces/{namespace}/pods/{name}"

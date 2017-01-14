.PHONY: clean 

IMAGE				 ?= hjacobs/kube-ops-view
TAG					 ?= latest
GITHEAD       		 = $(shell git rev-parse --short HEAD)
GITURL        		 = $(shell git config --get remote.origin.url)
GITSTATUS     		 = $(shell git status --porcelain || echo "no changes")

default: docker

build: appjs docker

clean:
	rm -fr kube_ops_view/static/build

test:
	tox

appjs:
	docker run -it -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app node:7.4-alpine npm install
	docker run -it -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app node:7.4-alpine npm run build

docker: appjs scm-source.json
	docker build -t "$(IMAGE):$(TAG)" .

push: docker
	docker push "$(IMAGE):$(TAG)"

mock:
	docker run -it -p 8080:8080 -e MOCK=true "$(IMAGE):$(TAG)"

scm-source.json: .git
	@echo '{"url": "$(GITURL)", "revision": "$(GITHEAD)", "author": "$(USER)", "status": "$(GITSTATUS)"}' > scm-source.json


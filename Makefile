.PHONY: clean test appjs docker push mock

IMAGE            ?= hjacobs/kube-ops-view
VERSION          ?= $(shell git describe --tags --always --dirty)
TAG              ?= $(VERSION)
GITHEAD          = $(shell git rev-parse --short HEAD)
GITURL           = $(shell git config --get remote.origin.url)
GITSTATU         = $(shell git status --porcelain || echo "no changes")

default: docker

clean:
	rm -fr kube_ops_view/static/build

test:
	tox

appjs:
	docker run -it -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app node:7.4-alpine npm install
	docker run -it -u $$(id -u) -v $$(pwd):/workdir -w /workdir/app node:7.4-alpine npm run build

docker: appjs scm-source.json
	docker build --build-arg "VERSION=$(VERSION)" -t "$(IMAGE):$(TAG)" .
	@echo 'Docker image $(IMAGE):$(TAG) can now be used.'

push: docker
	docker push "$(IMAGE):$(TAG)"

mock:
	docker run -it -p 8080:8080 "$(IMAGE):$(TAG)" --mock

scm-source.json: .git
	@echo '{"url": "$(GITURL)", "revision": "$(GITHEAD)", "author": "$(USER)", "status": "$(GITSTATUS)"}' > scm-source.json


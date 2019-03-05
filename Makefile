IMAGE ?= hjacobs/kube-ops-view
VERSION ?= $(shell git describe --tags --always --dirty)
TAG ?= $(VERSION)
BUILD_ARGS ?=

DEP = $(GOPATH)/bin/dep

$(DEP):
	go get github.com/golang/dep/cmd/dep

all: docker

vendor: $(DEP) Gopkg.lock
	$(DEP) ensure

.PHONY: ckeab
clean:
	rm -fr app/build vendor

.PHONY: docker
docker: vendor
	docker build $(BUILD_ARGS) --build-arg "VERSION=$(VERSION)" -t "$(IMAGE):$(TAG)" .
	@echo 'Docker image $(IMAGE):$(TAG) can now be used.'

.PHONY: push
push: docker
	docker push "$(IMAGE):$(TAG)"

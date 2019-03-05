ARG NODE_IMAGE=node:11
ARG GO_IMAGE=golang:1.11-stretch
ARG SCRATCH_IMAGE=scratch
ARG HTTP_PROXY
ARG NO_PROXY

ARG VERSION

FROM ${NODE_IMAGE} as jsbuild

WORKDIR /app

COPY app .
RUN npm install
RUN npm run webpack

FROM ${GO_IMAGE} as gobuild
WORKDIR /go/src/github.com/hjacobs/kube-ops-view
COPY vendor/ vendor
COPY main.go .
RUN go build -ldflags='-X main.verison=${VERSION}' -o kube-ops-view main.go

FROM ${SCRATCH_IMAGE}
WORKDIR /app
COPY static/ .
COPY --from=jsbuild /app/build/app.js static/
COPY --from=gobuild /go/src/github.com/hjacobs/kube-ops-view/kube-ops-view .
EXPOSE 8081
ENTRYPOINT ["/app/kube-ops-view"]
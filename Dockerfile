FROM alpine:3.20
ARG PB_VERSION=0.40.5
ARG TARGETARCH=amd64
RUN apk add --no-cache unzip ca-certificates wget \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb && rm /tmp/pb.zip
WORKDIR /pb
COPY pb_public ./pb_public
COPY pb_hooks ./pb_hooks
COPY pb_migrations ./pb_migrations
EXPOSE 8090
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations"]

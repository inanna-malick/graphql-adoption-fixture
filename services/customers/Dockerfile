FROM golang:1.22-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /out/customers .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=build /out/customers /usr/local/bin/customers
COPY schema.sql /app/schema.sql

EXPOSE 8003
CMD ["sh", "-c", "mkdir -p /app/data && customers"]

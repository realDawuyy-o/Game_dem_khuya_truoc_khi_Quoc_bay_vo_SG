FROM golang:1.26-alpine AS build

WORKDIR /src/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/badabum-server .

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=build /out/badabum-server /app/badabum-server
COPY web/ /app/web/
COPY sound_library/ /app/sound_library/

ENV PORT=8080 \
    SOUNDS_DIR=/app/sound_library \
    WEB_DIR=/app/web

EXPOSE 8080
ENTRYPOINT ["/app/badabum-server"]

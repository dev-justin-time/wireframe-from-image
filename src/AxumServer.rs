#[tokio::main]
async fn main() {

    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/upload", post(upload_file))
        .nest_service(
            "/",
            ServeDir::new("static"),
        );

    let listener =
        tokio::net::TcpListener::bind(
            "127.0.0.1:3000"
        )
        .await
        .unwrap();

    axum::serve(listener, app)
        .await
        .unwrap();
}



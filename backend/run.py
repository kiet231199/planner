import uvicorn

from app import app


HOST = "127.0.0.1"
PORT = 8000


if __name__ == "__main__":
    # Uvicorn serves the FastAPI app for local development.
    uvicorn.run(app, host=HOST, port=PORT)

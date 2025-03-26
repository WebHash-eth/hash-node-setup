interface WebSocketConfig {
  url: URL;
  messageHandler: (message: MessageEvent) => void;

  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly url: URL;
  private readonly messageHandler: (message: MessageEvent) => void;

  constructor({
    messageHandler,
    url,
    maxRetries = -1,
    baseDelay = 1000,
    maxDelay = 30000,
  }: WebSocketConfig) {
    this.url = url;
    this.messageHandler = messageHandler;
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.retryCount = 0;
  }

  private _retryConnection() {
    if (this.maxRetries < 0 || this.retryCount < this.maxRetries) {
      const delay = Math.min(
        this.baseDelay * Math.pow(2, this.retryCount),
        this.maxDelay,
      );
      this.retryCount++;

      console.log(
        `Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${this.retryCount}`,
      );
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error("Max retry attempts reached. Connection closed");
    }
  }

  public connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket connection established");
      this.retryCount = 0; // Reset retry count on successful connection
    };

    this.ws.onmessage = this.messageHandler;

    this.ws.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      if (error.type === "error") {
        this._retryConnection();
      }
    };

    this.ws.onclose = (event) => {
      console.log(
        `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason})`,
      );
      this._retryConnection();
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

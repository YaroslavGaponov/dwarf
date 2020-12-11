import express from "express";
import { INetworkServer } from "../interface";
import { Client, IAccess, ILogger, Logger, Setting } from "dwarf-sdk";
import WebSocker, { Server } from "ws";
import { createServer } from "http";
import { WSASERVICE_NOT_FOUND } from "constants";

export class HttpServer implements INetworkServer {

    @Logger
    private readonly logger!: ILogger;

    @Setting("PORT", 8081)
    private readonly port!: number;


    @Client("monitor", "secret")
    private readonly client!: IAccess;

    private readonly app = express();
    private readonly server;
    private readonly wss;

    private readonly clients: WebSocker[] = [];

    constructor(www: string) {

        this.server = createServer(this.app);
        this.wss = new Server({ server: this.server, path:"/ws" });
        this.wss.on('connection', (client: WebSocker) => this.clients.push(client));


        this.app.get("/request", async (req, res) => {
            const response = await this.client.request(req.query.name as string, req.query.method as string, JSON.parse(req.query.payload as string));
            res.json(response);
        })
        this.app.use("/", express.static(www));
    }

    async start(): Promise<void> {
        this.logger.info(`Monitor service is starting at http://localhost:${this.port}`);
        await this.client.connect();
        await this.client.subscribe("discovery:update", (channel: string, registry: any) => {
            this.clients.forEach(client => client.send(JSON.stringify(registry)));
        });
        return new Promise(resolve => this.server.listen(this.port, resolve));
    }

    async stop(): Promise<void> {
        await this.client.disconnect();
    }

}
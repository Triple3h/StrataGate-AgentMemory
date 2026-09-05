FROM node:22-bookworm AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build:core && npm run build:workbuddy && npm rebuild better-sqlite3 && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    STRATAGATE_DATA_DIR=/var/lib/stratagate \
    STRATAGATE_DATABASE=/var/lib/stratagate/memory.db \
    STRATAGATE_GATEWAY_HOST=0.0.0.0 \
    STRATAGATE_GATEWAY_PORT=43731
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/integrations/workbuddy/dist ./integrations/workbuddy/dist
COPY --from=build /app/integrations/workbuddy/package.json ./integrations/workbuddy/package.json
RUN mkdir -p /var/lib/stratagate && chown -R node:node /var/lib/stratagate /app
USER node
EXPOSE 43731
VOLUME ["/var/lib/stratagate"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:43731/ready',{headers:{authorization:'Bearer '+process.env.STRATAGATE_GATEWAY_TOKEN}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "integrations/workbuddy/dist/gateway.cjs"]

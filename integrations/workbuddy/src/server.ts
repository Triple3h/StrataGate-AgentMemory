process.env.STRATAGATE_SOURCE_ADAPTER ??= 'workbuddy'
process.env.STRATAGATE_AGENT_ID ??= 'workbuddy'
void import('../../../packages/gateway/src/mcp-server.js')

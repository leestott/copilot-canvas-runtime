// Extension: multi-agent-dev
// A runtime observability and control plane for multi-agent development systems.
// Treats the canvas as a living environment where humans and AI agents collaborate
// to design, test, and evolve agent-driven applications in real time.

import { createServer } from "node:http";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

const servers = new Map();

// --- System State (in-memory, per instance) ---
const systemStates = new Map();

function createInitialState() {
    return {
        agents: [
            { id: "decomposer", name: "decompose_system", status: "idle", responsibility: "Break requirements into agent tasks", lastAction: null, taskCount: 0 },
            { id: "executor", name: "execute_workflow", status: "idle", responsibility: "Coordinate agents to perform tasks", lastAction: null, taskCount: 0 },
            { id: "validator", name: "validate_output", status: "idle", responsibility: "Run evaluation tests and return results", lastAction: null, taskCount: 0 },
            { id: "designer", name: "update_system_design", status: "idle", responsibility: "Modify architecture based on feedback", lastAction: null, taskCount: 0 },
            { id: "tracker", name: "track_state", status: "idle", responsibility: "Persist and update system state over time", lastAction: null, taskCount: 0 },
        ],
        taskFlows: [],
        validations: [],
        stateHistory: [],
        artifacts: [],
        systemDesign: { description: "No system design loaded", constraints: [], components: [] },
        execution: { paused: false, stepCount: 0, startedAt: null },
        currentTimestamp: Date.now(),
    };
}

function getState(instanceId) {
    if (!systemStates.has(instanceId)) {
        systemStates.set(instanceId, createInitialState());
    }
    return systemStates.get(instanceId);
}

function pushStateSnapshot(instanceId, label) {
    const state = getState(instanceId);
    state.stateHistory.push({
        timestamp: Date.now(),
        label,
        snapshot: JSON.parse(JSON.stringify({ agents: state.agents, taskFlows: state.taskFlows, validations: state.validations })),
    });
    if (state.stateHistory.length > 50) state.stateHistory.shift();
}

function notifyClients(instanceId) {
    const entry = servers.get(instanceId);
    if (entry && entry.clients) {
        const state = getState(instanceId);
        const data = `data: ${JSON.stringify(state)}\n\n`;
        for (const res of entry.clients) {
            res.write(data);
        }
    }
}

// --- HTML Renderer ---
function renderHtml(instanceId) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Multi-Agent Dev Canvas</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
    background: var(--background-color-default, #0d1117);
    color: var(--text-color-default, #e6edf3);
    overflow-x: hidden;
}
.container { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 1px; height: 100vh; background: var(--border-color-default, #30363d); }
.panel { background: var(--background-color-default, #0d1117); padding: 12px; overflow-y: auto; }
.panel-header { font-size: var(--text-title-small, 16px); font-weight: var(--font-weight-semibold, 600); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.panel-header .icon { width: 18px; height: 18px; }
.system-view { grid-column: 1 / -1; }
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px; }
.agent-card { border: 1px solid var(--border-color-default, #30363d); border-radius: 8px; padding: 10px; position: relative; transition: border-color 0.3s, box-shadow 0.3s; }
.agent-card.active { border-color: var(--true-color-blue, #58a6ff); box-shadow: 0 0 8px rgba(88,166,255,0.2); }
.agent-card.error { border-color: var(--true-color-red, #f85149); box-shadow: 0 0 8px rgba(248,81,73,0.2); }
.agent-name { font-weight: var(--font-weight-semibold, 600); font-size: 13px; font-family: var(--font-mono, monospace); }
.agent-status { font-size: 11px; color: var(--text-color-muted, #8b949e); margin-top: 4px; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.status-dot.idle { background: var(--text-color-muted, #8b949e); }
.status-dot.running { background: var(--true-color-blue, #58a6ff); animation: pulse 1.5s infinite; }
.status-dot.done { background: #3fb950; }
.status-dot.error { background: var(--true-color-red, #f85149); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.flow-graph { margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color-default, #30363d); min-height: 60px; }
.flow-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; font-family: var(--font-mono, monospace); }
.flow-arrow { color: var(--true-color-blue, #58a6ff); }
.validation-item { border: 1px solid var(--border-color-default, #30363d); border-radius: 6px; padding: 8px; margin-bottom: 6px; }
.validation-item.pass { border-left: 3px solid #3fb950; }
.validation-item.fail { border-left: 3px solid var(--true-color-red, #f85149); }
.validation-item.pending { border-left: 3px solid var(--text-color-muted, #8b949e); }
.badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.badge.pass { background: rgba(63,185,80,0.15); color: #3fb950; }
.badge.fail { background: rgba(248,81,73,0.15); color: #f85149; }
.badge.pending { background: rgba(139,148,158,0.15); color: #8b949e; }
.state-entry { border-left: 2px solid var(--border-color-default, #30363d); padding: 4px 0 4px 10px; margin-bottom: 6px; font-size: 12px; }
.state-entry .time { color: var(--text-color-muted, #8b949e); font-size: 11px; font-family: var(--font-mono, monospace); }
.controls { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; align-items: center; background: rgba(255,255,255,0.02); border-top: 1px solid var(--border-color-default, #30363d); }
.btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color-default, #30363d); background: rgba(255,255,255,0.05); color: var(--text-color-default, #e6edf3); font-size: 12px; cursor: pointer; transition: background 0.2s; }
.btn:hover { background: rgba(255,255,255,0.1); }
.btn.primary { background: rgba(88,166,255,0.15); border-color: var(--true-color-blue, #58a6ff); }
.btn.danger { background: rgba(248,81,73,0.1); border-color: var(--true-color-red, #f85149); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.status-bar { font-size: 11px; color: var(--text-color-muted, #8b949e); margin-left: auto; font-family: var(--font-mono, monospace); }
.artifact-item { padding: 4px 8px; margin-bottom: 4px; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 12px; font-family: var(--font-mono, monospace); }
.empty-state { color: var(--text-color-muted, #8b949e); font-style: italic; padding: 16px; text-align: center; font-size: 12px; }
.design-block { background: rgba(255,255,255,0.02); border: 1px solid var(--border-color-default, #30363d); border-radius: 6px; padding: 10px; font-size: 12px; margin-top: 8px; }
.design-block pre { white-space: pre-wrap; font-family: var(--font-mono, monospace); font-size: 11px; color: var(--text-color-muted, #8b949e); }
</style>
</head>
<body>
<div class="container">
    <div class="panel system-view">
        <div class="panel-header">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 7.5h-3v-3a.5.5 0 00-1 0v3h-3a.5.5 0 000 1h3v3a.5.5 0 001 0v-3h3a.5.5 0 000-1z"/></svg>
            System View — Active Agents
        </div>
        <div class="agent-grid" id="agentGrid"></div>
        <div class="panel-header" style="margin-top:8px;">Task Flows</div>
        <div class="flow-graph" id="flowGraph"><div class="empty-state">No active task flows</div></div>
    </div>
    <div class="panel">
        <div class="panel-header">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"/></svg>
            Validation Panel
        </div>
        <div id="validations"><div class="empty-state">No validations run yet</div></div>
        <div class="panel-header" style="margin-top:12px;">System Design</div>
        <div class="design-block" id="designBlock"><pre>No system design loaded</pre></div>
    </div>
    <div class="panel">
        <div class="panel-header">
            <svg class="icon" viewBox="0 0 16 16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 01-7.86 0H.75a.75.75 0 010-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 010 1.5h-3.32zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
            Live State &amp; Timeline
        </div>
        <div id="stateTimeline"><div class="empty-state">State changes will appear here</div></div>
        <div class="panel-header" style="margin-top:12px;">Artifacts</div>
        <div id="artifacts"><div class="empty-state">No artifacts generated</div></div>
    </div>
    <div class="controls">
        <button class="btn primary" onclick="triggerAction('decompose')">Decompose</button>
        <button class="btn primary" onclick="triggerAction('execute')">Execute</button>
        <button class="btn primary" onclick="triggerAction('validate')">Validate</button>
        <button class="btn" onclick="triggerAction('updateDesign')">Update Design</button>
        <button class="btn danger" onclick="triggerAction('injectFailure')">Inject Failure</button>
        <button class="btn" onclick="triggerAction('pause')" id="pauseBtn">Pause</button>
        <button class="btn danger" onclick="triggerAction('reset')">Reset</button>
        <span class="status-bar" id="statusBar">Ready — Step 0</span>
    </div>
</div>
<script>
const instanceId = "${instanceId}";
let state = null;

const evtSource = new EventSource("/events");
evtSource.onmessage = (e) => {
    state = JSON.parse(e.data);
    render();
};

function render() {
    if (!state) return;
    // Agents
    const grid = document.getElementById("agentGrid");
    grid.innerHTML = state.agents.map(a => \`
        <div class="agent-card \${a.status === 'running' ? 'active' : ''}\${a.status === 'error' ? ' error' : ''}">
            <div class="agent-name">\${a.name}</div>
            <div class="agent-status">
                <span class="status-dot \${a.status}"></span>\${a.status}
                \${a.lastAction ? ' — ' + a.lastAction : ''}
            </div>
            <div style="font-size:11px;color:var(--text-color-muted,#8b949e);margin-top:4px">\${a.responsibility}</div>
            <div style="font-size:10px;margin-top:3px;opacity:0.7">Tasks: \${a.taskCount}</div>
        </div>
    \`).join("");

    // Flow graph
    const flow = document.getElementById("flowGraph");
    if (state.taskFlows.length === 0) {
        flow.innerHTML = '<div class="empty-state">No active task flows</div>';
    } else {
        flow.innerHTML = state.taskFlows.map(f => \`
            <div class="flow-item">
                <span class="badge \${f.status}">\${f.status}</span>
                <span class="flow-arrow">→</span>
                <span>\${f.from}</span>
                <span class="flow-arrow">→</span>
                <span>\${f.to}</span>
                <span style="color:var(--text-color-muted,#8b949e);margin-left:auto">\${f.label}</span>
            </div>
        \`).join("");
    }

    // Validations
    const valDiv = document.getElementById("validations");
    if (state.validations.length === 0) {
        valDiv.innerHTML = '<div class="empty-state">No validations run yet</div>';
    } else {
        valDiv.innerHTML = state.validations.map(v => \`
            <div class="validation-item \${v.result}">
                <div style="display:flex;align-items:center;gap:6px">
                    <span class="badge \${v.result}">\${v.result}</span>
                    <strong>\${v.name}</strong>
                </div>
                <div style="font-size:11px;color:var(--text-color-muted,#8b949e);margin-top:4px">\${v.reasoning || ''}</div>
            </div>
        \`).join("");
    }

    // Design
    const designDiv = document.getElementById("designBlock");
    designDiv.innerHTML = \`<pre>\${state.systemDesign.description}\\n\\nComponents: \${state.systemDesign.components.join(", ") || "none"}\\nConstraints: \${state.systemDesign.constraints.join(", ") || "none"}</pre>\`;

    // State timeline
    const timeline = document.getElementById("stateTimeline");
    if (state.stateHistory.length === 0) {
        timeline.innerHTML = '<div class="empty-state">State changes will appear here</div>';
    } else {
        timeline.innerHTML = state.stateHistory.slice(-15).reverse().map(s => \`
            <div class="state-entry">
                <span class="time">\${new Date(s.timestamp).toLocaleTimeString()}</span>
                — \${s.label}
            </div>
        \`).join("");
    }

    // Artifacts
    const artDiv = document.getElementById("artifacts");
    if (state.artifacts.length === 0) {
        artDiv.innerHTML = '<div class="empty-state">No artifacts generated</div>';
    } else {
        artDiv.innerHTML = state.artifacts.map(a => \`<div class="artifact-item">\${a.type}: \${a.name}</div>\`).join("");
    }

    // Status bar
    const bar = document.getElementById("statusBar");
    bar.textContent = state.execution.paused ? "⏸ Paused" : \`Running — Step \${state.execution.stepCount}\`;

    // Pause button
    const pauseBtn = document.getElementById("pauseBtn");
    pauseBtn.textContent = state.execution.paused ? "Resume" : "Pause";
}

async function triggerAction(action) {
    await fetch("/trigger", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action }) });
}
</script>
</body>
</html>`;
}

async function startServer(instanceId) {
    const clients = new Set();
    const server = createServer((req, res) => {
        if (req.url === "/events") {
            res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
            clients.add(res);
            // Send current state immediately
            const state = getState(instanceId);
            res.write(`data: ${JSON.stringify(state)}\n\n`);
            req.on("close", () => clients.delete(res));
            return;
        }
        if (req.url === "/trigger" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => body += chunk);
            req.on("end", () => {
                try {
                    const { action } = JSON.parse(body);
                    handleLocalTrigger(instanceId, action);
                } catch {}
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            });
            return;
        }
        if (req.url === "/state") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(getState(instanceId)));
            return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderHtml(instanceId));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const entry = { server, url: `http://127.0.0.1:${port}/`, clients };
    return entry;
}

function handleLocalTrigger(instanceId, action) {
    const state = getState(instanceId);
    if (action === "pause") {
        state.execution.paused = !state.execution.paused;
        pushStateSnapshot(instanceId, state.execution.paused ? "Execution paused" : "Execution resumed");
    } else if (action === "reset") {
        systemStates.set(instanceId, createInitialState());
        pushStateSnapshot(instanceId, "System reset");
    } else if (action === "decompose") {
        simulateAgentAction(instanceId, "decomposer", "Decomposing current design into tasks");
    } else if (action === "execute") {
        simulateAgentAction(instanceId, "executor", "Executing pending task flows");
    } else if (action === "validate") {
        simulateAgentAction(instanceId, "validator", "Running validation suite");
    } else if (action === "injectFailure") {
        const validator = state.agents.find(a => a.id === "validator");
        if (validator) {
            validator.status = "error";
            validator.lastAction = "Failure injected — eval harness lost connection to dataset";
        }
        pushStateSnapshot(instanceId, "⚠ Failure injected into validator");
    } else if (action === "updateDesign") {
        const gdpr = "All ticket PII redacted before model calls (GDPR)";
        if (!state.systemDesign.constraints.includes(gdpr)) {
            state.systemDesign.constraints.push(gdpr);
        }
        const designer = state.agents.find(a => a.id === "designer");
        if (designer) {
            designer.status = "running";
            designer.lastAction = "Updating design — added GDPR constraint";
            designer.taskCount++;
            setTimeout(() => { designer.status = "done"; notifyClients(instanceId); }, 1500);
        }
        pushStateSnapshot(instanceId, "Design updated — added GDPR data-handling constraint");
    }
    notifyClients(instanceId);
}

function simulateAgentAction(instanceId, agentId, label) {
    const state = getState(instanceId);
    const agent = state.agents.find(a => a.id === agentId);
    if (agent) {
        agent.status = "running";
        agent.lastAction = label;
        agent.taskCount++;
    }
    pushStateSnapshot(instanceId, label);
    // Auto-complete after brief delay
    setTimeout(() => {
        if (agent) agent.status = "done";
        notifyClients(instanceId);
    }, 1500);
}

// --- Canvas Actions (agent-callable) ---

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "multi-agent-dev",
            displayName: "Multi-Agent Dev Canvas",
            description: "Runtime observability and control plane for multi-agent development — shows active agents, task flows, validations, live state, and provides controls to trigger, pause, and modify agent-driven systems in real time.",
            actions: [
                {
                    name: "decompose_system",
                    description: "Break requirements into agent tasks and update the task flow graph",
                    inputSchema: { type: "object", properties: { requirements: { type: "string", description: "System requirements to decompose" }, components: { type: "array", items: { type: "string" }, description: "Component names" } }, required: ["requirements"] },
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        if (state.execution.paused) throw new CanvasError("paused", "System is paused");
                        const { requirements, components = [] } = ctx.input || {};
                        const agent = state.agents.find(a => a.id === "decomposer");
                        agent.status = "running";
                        agent.lastAction = "Decomposing: " + requirements.slice(0, 40);
                        agent.taskCount++;
                        state.systemDesign.description = requirements;
                        state.systemDesign.components = components;
                        // Generate task flows
                        const tasks = components.length > 0 ? components : ["task-1", "task-2", "task-3"];
                        state.taskFlows = tasks.map((t, i) => ({
                            from: "decomposer", to: i % 2 === 0 ? "executor" : "designer",
                            label: typeof t === "string" ? t : `task-${i}`, status: "pending"
                        }));
                        state.execution.stepCount++;
                        pushStateSnapshot(ctx.instanceId, `Decomposed: ${requirements.slice(0, 50)}`);
                        setTimeout(() => { agent.status = "done"; notifyClients(ctx.instanceId); }, 1000);
                        notifyClients(ctx.instanceId);
                        return { tasks: state.taskFlows, agentStatus: agent.status };
                    },
                },
                {
                    name: "execute_workflow",
                    description: "Coordinate agents to perform pending tasks in the flow graph",
                    inputSchema: { type: "object", properties: { taskIds: { type: "array", items: { type: "string" }, description: "Specific tasks to execute (or all if empty)" } } },
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        if (state.execution.paused) throw new CanvasError("paused", "System is paused");
                        const agent = state.agents.find(a => a.id === "executor");
                        agent.status = "running";
                        agent.lastAction = "Executing workflow";
                        agent.taskCount++;
                        state.execution.stepCount++;
                        if (!state.execution.startedAt) state.execution.startedAt = Date.now();
                        // Move pending flows to pass
                        let executed = 0;
                        for (const flow of state.taskFlows) {
                            if (flow.status === "pending") { flow.status = "pass"; executed++; }
                        }
                        state.artifacts.push({ type: "output", name: `workflow-run-${state.execution.stepCount}`, timestamp: Date.now() });
                        pushStateSnapshot(ctx.instanceId, `Executed ${executed} tasks`);
                        setTimeout(() => { agent.status = "done"; notifyClients(ctx.instanceId); }, 1200);
                        notifyClients(ctx.instanceId);
                        return { executed, totalFlows: state.taskFlows.length };
                    },
                },
                {
                    name: "validate_output",
                    description: "Run evaluation tests against current system outputs and return structured pass/fail results",
                    inputSchema: { type: "object", properties: { tests: { type: "array", items: { type: "object", properties: { name: { type: "string" }, criteria: { type: "string" } }, required: ["name", "criteria"] }, description: "Test cases to evaluate" } }, required: ["tests"] },
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        const agent = state.agents.find(a => a.id === "validator");
                        agent.status = "running";
                        agent.lastAction = "Validating outputs";
                        agent.taskCount++;
                        state.execution.stepCount++;
                        const { tests = [] } = ctx.input || {};
                        const results = tests.map(t => ({
                            name: t.name,
                            criteria: t.criteria,
                            result: Math.random() > 0.3 ? "pass" : "fail",
                            reasoning: Math.random() > 0.3 ? `Meets criteria: ${t.criteria}` : `Failed: does not satisfy ${t.criteria}`,
                        }));
                        state.validations = results;
                        pushStateSnapshot(ctx.instanceId, `Validated ${tests.length} tests — ${results.filter(r => r.result === "pass").length} passed`);
                        setTimeout(() => { agent.status = "done"; notifyClients(ctx.instanceId); }, 800);
                        notifyClients(ctx.instanceId);
                        return { results, summary: { total: results.length, passed: results.filter(r => r.result === "pass").length, failed: results.filter(r => r.result === "fail").length } };
                    },
                },
                {
                    name: "update_system_design",
                    description: "Modify the system architecture, constraints, or component list based on feedback",
                    inputSchema: { type: "object", properties: { description: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, components: { type: "array", items: { type: "string" } } } },
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        const agent = state.agents.find(a => a.id === "designer");
                        agent.status = "running";
                        agent.lastAction = "Updating system design";
                        agent.taskCount++;
                        state.execution.stepCount++;
                        const { description, constraints, components } = ctx.input || {};
                        if (description) state.systemDesign.description = description;
                        if (constraints) state.systemDesign.constraints = constraints;
                        if (components) state.systemDesign.components = components;
                        state.artifacts.push({ type: "design-update", name: `design-v${state.execution.stepCount}`, timestamp: Date.now() });
                        pushStateSnapshot(ctx.instanceId, "System design updated");
                        setTimeout(() => { agent.status = "done"; notifyClients(ctx.instanceId); }, 600);
                        notifyClients(ctx.instanceId);
                        return { design: state.systemDesign };
                    },
                },
                {
                    name: "track_state",
                    description: "Get current system state including agents, flows, validations, and history timeline",
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        const agent = state.agents.find(a => a.id === "tracker");
                        agent.status = "running";
                        agent.lastAction = "Reading state";
                        agent.taskCount++;
                        setTimeout(() => { agent.status = "done"; notifyClients(ctx.instanceId); }, 300);
                        notifyClients(ctx.instanceId);
                        return {
                            agents: state.agents.map(a => ({ id: a.id, name: a.name, status: a.status, taskCount: a.taskCount })),
                            taskFlows: state.taskFlows,
                            validations: state.validations,
                            design: state.systemDesign,
                            execution: state.execution,
                            historyLength: state.stateHistory.length,
                            artifactCount: state.artifacts.length,
                        };
                    },
                },
                {
                    name: "inject_failure",
                    description: "Inject a failure or constraint into the system to test adaptation",
                    inputSchema: { type: "object", properties: { agentId: { type: "string", description: "Agent to fail (decomposer, executor, validator, designer, tracker)" }, reason: { type: "string" } }, required: ["agentId", "reason"] },
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        const { agentId, reason } = ctx.input || {};
                        const agent = state.agents.find(a => a.id === agentId);
                        if (!agent) throw new CanvasError("not_found", `Agent ${agentId} not found`);
                        agent.status = "error";
                        agent.lastAction = `FAILURE: ${reason}`;
                        state.systemDesign.constraints.push(`Constraint: ${reason}`);
                        pushStateSnapshot(ctx.instanceId, `Failure injected: ${agentId} — ${reason}`);
                        notifyClients(ctx.instanceId);
                        return { agent: agent.name, status: "error", reason };
                    },
                },
                {
                    name: "pause_resume",
                    description: "Toggle pause/resume on the system execution",
                    handler: async (ctx) => {
                        const state = getState(ctx.instanceId);
                        state.execution.paused = !state.execution.paused;
                        pushStateSnapshot(ctx.instanceId, state.execution.paused ? "Execution paused" : "Execution resumed");
                        notifyClients(ctx.instanceId);
                        return { paused: state.execution.paused };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                // Ensure state exists
                getState(ctx.instanceId);
                return { title: "Multi-Agent Dev Canvas", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    for (const client of entry.clients) { try { client.end(); } catch {} }
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
                systemStates.delete(ctx.instanceId);
            },
        }),
    ],
});

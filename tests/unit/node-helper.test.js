const assert = require("node:assert/strict");
const Module = require("node:module");
const {describe, test} = require("node:test");

const helperPath = require.resolve("../../node_helper.js");
const originalRequire = Module.prototype.require;
const logger = {
    debug: () => true,
    error: () => true,
    log: () => true,
    warn: () => true
};

Module.prototype.require = function require (request) {
    if (this.filename === helperPath) {
        if (request === "node_helper") {
            return {create: (definition) => definition};
        }
        if (request === "logger") {
            return logger;
        }
    }
    return originalRequire.call(this, request);
};

let helper = null;
try {
    helper = require("../../node_helper.js");
} finally {
    Module.prototype.require = originalRequire;
}

const testActiveLowEdgesAndDuration = (testContext) => {
    const notifications = [];
    const buttonContext = {
        buttons: [{name: "default", pressed: null}],
        sendSocketNotification (notification, payload) {
            notifications.push({notification, payload});
        }
    };
    let now = 1000;
    testContext.mock.method(Date, "now", () => now);

    helper.handleGpioEvent.call(buttonContext, 0, "falling");
    now = 1425;
    helper.handleGpioEvent.call(buttonContext, 0, "rising");

    assert.deepEqual(notifications, [
        {notification: "BUTTON_DOWN", payload: {index: 0}},
        {notification: "BUTTON_UP", payload: {index: 0, duration: 425}}
    ]);
    assert.equal(buttonContext.buttons[0].pressed, null);
};

const testActiveHighEdges = (testContext) => {
    const notifications = [];
    const buttonContext = {
        buttons: [{name: "active-high", activeLow: false, pressed: null}],
        sendSocketNotification (notification, payload) {
            notifications.push({notification, payload});
        }
    };
    let now = 2000;
    testContext.mock.method(Date, "now", () => now);

    helper.handleGpioEvent.call(buttonContext, 0, "falling");
    assert.deepEqual(notifications, []);
    helper.handleGpioEvent.call(buttonContext, 0, "rising");
    now = 2120;
    helper.handleGpioEvent.call(buttonContext, 0, "falling");

    assert.deepEqual(notifications, [
        {notification: "BUTTON_DOWN", payload: {index: 0}},
        {notification: "BUTTON_UP", payload: {index: 0, duration: 120}}
    ]);
};

const testGpiomonOutputFormats = (testContext) => {
    const edges = [];
    testContext.mock.method(helper, "handleGpioEvent", (index, edge) => {
        edges.push({index, edge});
    });

    helper.parseGpiomonOutput(Buffer.from([
        "1702483200.123456789 rising 24",
        "FALLING EDGE: 24",
        "no edge in this line"
    ].join("\n")), 3, 24);

    assert.deepEqual(edges, [
        {index: 3, edge: "rising"},
        {index: 3, edge: "falling"}
    ]);
};

describe("MMM-Buttons node helper", () => {
    test("uses active-low edges by default and reports the press duration", testActiveLowEdgesAndDuration);
    test("reverses press edges for active-high buttons", testActiveHighEdges);
    test("parses rising and falling edges from both gpiomon formats", testGpiomonOutputFormats);
});

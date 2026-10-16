const assert = require("node:assert/strict");
const {describe, test} = require("node:test");

let definition = null;
const previousModule = global.Module;
const modulePath = require.resolve("../../MMM-Buttons.js");

global.Module = {
    register (name, moduleDefinition) {
        assert.equal(name, "MMM-Buttons");
        definition = moduleDefinition;
    }
};

try {
    require(modulePath);
} finally {
    if (typeof previousModule === "undefined") {
        delete global.Module;
    } else {
        global.Module = previousModule;
    }
}

const createModule = () => {
    const notifications = [];
    const updates = [];
    return {
        ...definition,
        config: {
            buttons: [
                {
                    shortPress: [{notification: "SHORT", payload: {action: "short"}}],
                    longPress: [{notification: "LONG", payload: {action: "long"}}]
                }
            ],
            minShortPressTime: 100,
            maxShortPressTime: 1000,
            minLongPressTime: 3000,
            debugLimit: 2
        },
        data: {},
        eventLog: [],
        notifications,
        updates,
        sendNotification (notification, payload) {
            notifications.push({notification, payload});
        },
        updateDom () {
            updates.push(true);
        }
    };
};

const testButtonUpReleaseFlow = (testContext) => {
    const moduleInstance = createModule();
    const clearedIntervals = [];
    moduleInstance.data.position = "bottom_left";
    moduleInstance.alerts = [true];
    moduleInstance.intervals = [42];
    moduleInstance.config.buttons[0].name = "test-button";
    testContext.mock.method(global, "clearInterval", (interval) => {
        clearedIntervals.push(interval);
    });

    moduleInstance.buttonUp(0, 3000);

    assert.deepEqual(clearedIntervals, [42]);
    assert.equal(moduleInstance.alerts[0], false);
    assert.equal(moduleInstance.intervals[0], null);
    assert.deepEqual(moduleInstance.notifications.map(({notification}) => notification), [
        "HIDE_ALERT",
        "LONG"
    ]);
    assert.equal(Object.hasOwn(moduleInstance.notifications[0], "payload"), true);
    assert.deepEqual(moduleInstance.notifications[1].payload, {action: "long"});

    const [event] = moduleInstance.eventLog;
    assert.ok(event.time);
    assert.deepEqual({
        type: event.type,
        index: event.index,
        name: event.name,
        duration: event.duration,
        pressType: event.pressType,
        actions: event.actions
    }, {
        type: "up",
        index: 0,
        name: "test-button",
        duration: 3000,
        pressType: "long",
        actions: ["LONG(long)"]
    });
};

describe("MMM-Buttons frontend", () => {
    test("classifies the inclusive short-press range", () => {
        const moduleInstance = createModule();

        for (const duration of [100, 1000]) {
            const result = moduleInstance.processButtonPress(0, duration);
            assert.equal(result.pressType, "short");
            assert.deepEqual(result.actions, ["SHORT(short)"]);
        }

        assert.deepEqual(moduleInstance.notifications, [
            {notification: "SHORT", payload: {action: "short"}},
            {notification: "SHORT", payload: {action: "short"}}
        ]);
    });

    test("does not classify the gap, and starts long presses at the threshold", () => {
        const moduleInstance = createModule();

        assert.deepEqual(moduleInstance.processButtonPress(0, 1001), {
            pressType: null,
            actions: []
        });
        assert.equal(moduleInstance.processButtonPress(0, 3000).pressType, "long");
        assert.deepEqual(moduleInstance.notifications, [{notification: "LONG", payload: {action: "long"}}]);
    });

    test("keeps only the configured number of debug events", () => {
        const moduleInstance = createModule();
        moduleInstance.data.position = "bottom_left";

        for (const type of ["down", "up", "down"]) {
            moduleInstance.logEvent({type, index: 0});
        }

        assert.equal(moduleInstance.eventLog.length, 2);
        assert.equal(moduleInstance.eventLog[0].type, "up");
        assert.equal(moduleInstance.eventLog[1].type, "down");
        assert.equal(moduleInstance.updates.length, 3);
    });

    test("handles release alerts, actions, and debug logging together", testButtonUpReleaseFlow);
});

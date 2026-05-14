(function () {
    "use strict";

    const API_BASE = "https://api.green-api.com";

    const $ = (id) => document.getElementById(id);

    const els = {
        idInstance: $("idInstance"),
        apiToken: $("apiTokenInstance"),
        phoneMessage: $("phoneMessage"),
        messageText: $("messageText"),
        phoneFile: $("phoneFile"),
        fileUrl: $("fileUrl"),
        response: $("responseOutput"),
        buttons: {
            getSettings: $("btnGetSettings"),
            getStateInstance: $("btnGetStateInstance"),
            sendMessage: $("btnSendMessage"),
            sendFileByUrl: $("btnSendFileByUrl"),
            clear: $("btnClear"),
        },
    };

    const STORAGE_KEY = "green-api-creds";

    function loadCreds() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (saved && saved.idInstance) els.idInstance.value = saved.idInstance;
            if (saved && saved.apiToken) els.apiToken.value = saved.apiToken;
        } catch (_) {}
    }

    function saveCreds() {
        const data = {
            idInstance: els.idInstance.value.trim(),
            apiToken: els.apiToken.value.trim(),
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (_) {}
    }

    function getCreds() {
        const idInstance = els.idInstance.value.trim();
        const apiToken = els.apiToken.value.trim();
        if (!idInstance || !apiToken) {
            throw new Error("Заполните idInstance и ApiTokenInstance");
        }
        return { idInstance, apiToken };
    }

    function normalizePhone(raw) {
        const digits = String(raw || "").replace(/\D/g, "");
        if (!digits) throw new Error("Введите номер получателя");
        if (digits.length < 10 || digits.length > 15) {
            throw new Error("Номер должен содержать 10-15 цифр (в международном формате, без +)");
        }
        return digits;
    }

    function toChatId(phone) {
        return `${normalizePhone(phone)}@c.us`;
    }

    function setOutput(value) {
        if (typeof value === "string") {
            els.response.value = value;
        } else {
            els.response.value = JSON.stringify(value, null, 2);
        }
    }

    function setBusy(btn, busy) {
        btn.disabled = busy;
        if (busy) {
            btn.dataset.label = btn.dataset.label || btn.textContent;
            btn.textContent = "Загрузка…";
        } else if (btn.dataset.label) {
            btn.textContent = btn.dataset.label;
        }
    }

    async function callApi(method, path, body) {
        const url = `${API_BASE}${path}`;
        const init = {
            method,
            headers: { "Content-Type": "application/json" },
        };
        if (body !== undefined) init.body = JSON.stringify(body);

        const res = await fetch(url, init);
        const text = await res.text();
        let parsed;
        try {
            parsed = text ? JSON.parse(text) : {};
        } catch (_) {
            parsed = { raw: text };
        }
        if (!res.ok) {
            const err = new Error(`HTTP ${res.status} ${res.statusText}`);
            err.payload = parsed;
            err.status = res.status;
            throw err;
        }
        return parsed;
    }

    async function run(btn, fn) {
        setBusy(btn, true);
        try {
            const { idInstance, apiToken } = getCreds();
            saveCreds();
            const result = await fn(idInstance, apiToken);
            setOutput(result);
        } catch (err) {
            const payload = {
                error: err.message,
                ...(err.status ? { status: err.status } : {}),
                ...(err.payload ? { details: err.payload } : {}),
            };
            setOutput(payload);
        } finally {
            setBusy(btn, false);
        }
    }

    function bind() {
        els.buttons.getSettings.addEventListener("click", () => {
            run(els.buttons.getSettings, (id, token) =>
                callApi("GET", `/waInstance${id}/getSettings/${token}`)
            );
        });

        els.buttons.getStateInstance.addEventListener("click", () => {
            run(els.buttons.getStateInstance, (id, token) =>
                callApi("GET", `/waInstance${id}/getStateInstance/${token}`)
            );
        });

        els.buttons.sendMessage.addEventListener("click", () => {
            run(els.buttons.sendMessage, (id, token) => {
                const chatId = toChatId(els.phoneMessage.value);
                const message = els.messageText.value;
                if (!message.trim()) throw new Error("Введите текст сообщения");
                return callApi("POST", `/waInstance${id}/sendMessage/${token}`, {
                    chatId,
                    message,
                });
            });
        });

        els.buttons.sendFileByUrl.addEventListener("click", () => {
            run(els.buttons.sendFileByUrl, (id, token) => {
                const chatId = toChatId(els.phoneFile.value);
                const urlFile = els.fileUrl.value.trim();
                if (!urlFile) throw new Error("Введите URL файла");
                const fileName = urlFile.split("/").pop() || "file";
                return callApi("POST", `/waInstance${id}/sendFileByUrl/${token}`, {
                    chatId,
                    urlFile,
                    fileName,
                });
            });
        });

        els.buttons.clear.addEventListener("click", () => setOutput(""));
    }

    loadCreds();
    bind();
})();

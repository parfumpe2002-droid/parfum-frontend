const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "../public_html/js/api.js"), "utf8");

class MemoryStorage {
    constructor(initial = {}) { this.data = {...initial}; }
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
    setItem(key, value) { this.data[key] = String(value); }
    removeItem(key) { delete this.data[key]; }
}

function harness({local = {}, session = {}, fetchImpl = async () => ({ok:true, status:200, text:async () => "{}"})} = {}) {
    const localStorage = new MemoryStorage(local);
    const sessionStorage = new MemoryStorage(session);
    const events = [];
    const window = {dispatchEvent:event => events.push(event.type)};
    const context = {
        window, localStorage, sessionStorage, fetch:fetchImpl, Headers, AbortController,
        setTimeout, clearTimeout, CustomEvent:class {constructor(type) {this.type = type;}},
        location:{href:"", pathname:"/admin.html"},
        PARFUM_CONFIG:{API_BASE:"https://api.example.test", API_TIMEOUT_MS:5000}
    };
    vm.runInNewContext(code, context);
    return {api:window.ParfumAPI, localStorage, sessionStorage, events, location:context.location};
}
const admin = {id:101, rol:"ADMIN", nombre:"Admin", email:"admin@example.test"};
const user = {id:200, rol:"USER", nombre:"Cliente"};

test("Una ficha de usuario huérfana no hace que Parfum aparezca conectado", () => {
    const {api, localStorage} = harness({local:{parfum_usuario:JSON.stringify(admin)}});
    assert.equal(api.getUser(), null);
    assert.equal(api.isLogged(), false);
    assert.equal(api.isAdmin(), false);
    assert.equal(localStorage.getItem("parfum_usuario"), null);
});

test("La sesión normal guarda token y usuario en la misma pestaña", () => {
    const h = harness({local:{parfum_usuario:JSON.stringify(user)}});
    h.api.setSession({token:"token-admin",usuario:admin});
    assert.equal(h.sessionStorage.getItem("parfum_token"), "token-admin");
    assert.equal(JSON.parse(h.sessionStorage.getItem("parfum_usuario")).rol,"ADMIN");
    assert.equal(h.localStorage.getItem("parfum_token"), null);
    assert.equal(h.localStorage.getItem("parfum_usuario"), null);
    assert.equal(h.api.isAdmin(),true);
    // Otra pestaña sin sessionStorage no puede mostrar el perfil como si estuviera conectada.
    const otherTab = harness({local:h.localStorage.data});
    assert.equal(otherTab.api.getUser(), null);
    assert.equal(otherTab.api.isLogged(),false);
});

test("Mantener sesión conserva ambos datos para nuevas pestañas y se elimina al cerrar", () => {
    const h = harness();
    h.api.setSession({token:"token-remember",usuario:admin},{remember:true});
    assert.equal(h.localStorage.getItem("parfum_token"), "token-remember");
    assert.equal(h.sessionStorage.getItem("parfum_token"), null);
    const otherTab = harness({local:h.localStorage.data});
    assert.equal(otherTab.api.isLogged(),true);
    assert.equal(otherTab.api.isAdmin(),true);
    otherTab.api.clearSession();
    assert.equal(otherTab.api.isLogged(),false);
    assert.equal(otherTab.localStorage.getItem("parfum_usuario"),null);
});

test("Al recibir 401 con token actual, se elimina la sesión y se solicita reingreso", async () => {
    const h=harness({fetchImpl:async()=>({ok:false,status:401,text:async()=>JSON.stringify({message:"No autorizado"})})});
    h.api.setSession({token:"expired",usuario:user},{remember:true});
    await assert.rejects(h.api.request("/usuarios/me"),/No autorizado/);
    assert.equal(h.api.isLogged(),false);
    assert.deepEqual(h.events,["parfum:session-expired"]);
});

test("Un 401 público o de login no debe borrar la sesión del usuario", async () => {
    const h=harness({fetchImpl:async()=>({ok:false,status:401,text:async()=>JSON.stringify({message:"Credenciales incorrectas"})})});
    h.api.setSession({token:"valid",usuario:admin},{remember:true});
    await assert.rejects(h.api.request("/auth/login",{auth:false}),/Credenciales incorrectas/);
    assert.equal(h.api.getToken(),"valid");
    assert.equal(h.api.isAdmin(),true);
    assert.equal(h.events.length,0);
});

test("Una respuesta tardía 401 de una sesión antigua no elimina el login nuevo", async () => {
    let complete;
    const pending=new Promise(resolve=>{complete=resolve;});
    const h=harness({fetchImpl:async()=>pending});
    h.api.setSession({token:"previous",usuario:user},{remember:true});
    const request=h.api.request("/usuarios/me");
    h.api.setSession({token:"newer",usuario:admin},{remember:true});
    complete({ok:false,status:401,text:async()=>JSON.stringify({message:"Antiguo"})});
    await assert.rejects(request,/Antiguo/);
    assert.equal(h.api.getToken(),"newer");
    assert.equal(h.api.isAdmin(),true);
    assert.equal(h.events.length,0);
});

test("La cuenta actualizada queda junto al token, sin datos antiguos de otras sesiones", () => {
    const h=harness({local:{parfum_usuario:JSON.stringify(user)},session:{parfum_token:"legacy"}});
    assert.equal(h.api.getUser().rol,"USER"); // Compatibilidad con sesión anterior.
    h.api.updateUser(admin);
    assert.equal(h.api.getUser().rol,"ADMIN");
    assert.equal(h.localStorage.getItem("parfum_usuario"),null);
});

test("El login ofrece conservar la sesión de forma opcional", () => {
    const html=fs.readFileSync(path.join(__dirname,"../public_html/login.html"),"utf8");
    assert.match(html,/id="rememberSession"/);
    assert.match(html,/Mantener sesión iniciada/);
    assert.doesNotMatch(html,/id="rememberSession"[^>]*checked/);
});

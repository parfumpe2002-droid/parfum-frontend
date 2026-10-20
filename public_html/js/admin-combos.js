(() => {
    "use strict";
    if (!ParfumAPI.isAdmin()) return;
    const $ = id => document.getElementById(id);
    const esc = value => ParfumAPI.escapeHtml(value == null ? "" : String(value));
    const notify = (message, type = "error") => {
        $("comboMessage").textContent = message;
        $("comboMessage").className = "form-message " + type;
    };
    let catalog = [];
    let combos = [];
    let imageUrl = "";
    let loaded = false;
    let working = false;
    const form = $("comboForm");

    function productById(id) { return catalog.find(x => String(x.id) === String(id)); }
    function variants(product, type) {
        if (!product) return [];
        if (type === "DECANT") return product.decantDisponible === false ? [] :
            (product.decants || []).filter(x => x.activo !== false);
        const bottles = (product.presentaciones || []).filter(x => x.activo !== false);
        return bottles.length ? bottles : [{id:"",etiqueta:"Frasco completo",stock:product.stock,precio:product.precio}];
    }
    function options(list, value, label) {
        return '<option value="">'+esc(label)+'</option>' +
            list.map(x => '<option value="'+esc(x.id)+'"'+(String(x.id) === String(value) ? ' selected' : '')+'>'+esc(x.nombre)+' · '+esc(x.marca)+'</option>').join("");
    }
    function readRows() {
        return [...$("comboComponentRows").querySelectorAll("[data-combo-row]")].map(el => ({
            productoId:el.querySelector("[data-combo-product]").value,
            tipoItem:el.querySelector("[data-combo-type]").value,
            varianteId:el.querySelector("[data-combo-variant]").value,
            cantidad:el.querySelector("[data-combo-qty]").value
        }));
    }
    function rowMarkup(item, index) {
        const product = productById(item.productoId);
        const type = item.tipoItem || "DECANT";
        const available = variants(product,type);
        const selected = item.varianteId == null ? "" : String(item.varianteId);
        const items = available.length ? available.map(v =>
            '<option value="'+esc(v.id == null ? "" : v.id)+'"'+
            (String(v.id == null ? "" : v.id) === selected ? ' selected' : '')+'>'+
            esc(v.etiqueta || ((v.mililitros || "") + " ml"))+
            ' · Stock '+esc(v.stock)+' · '+esc(ParfumAPI.money(v.precio))+'</option>'
        ).join("") : '<option value="">Selecciona un perfume con presentaciones disponibles</option>';
        return '<div class="combo-component-row" data-combo-row>'+
          '<div class="field"><label>Perfume '+(index+1)+'</label><select data-combo-product required>'+
          options(catalog.filter(p=>p.activo !== false),item.productoId,"Seleccionar perfume")+'</select></div>'+
          '<div class="field"><label>Tipo</label><select data-combo-type>'+
          '<option value="DECANT"'+(type === "DECANT" ? ' selected' : '')+'>Decant</option>'+
          '<option value="BOTELLA"'+(type === "BOTELLA" ? ' selected' : '')+'>Frasco</option></select></div>'+
          '<div class="field"><label>Presentación</label><select data-combo-variant required>'+items+'</select></div>'+
          '<div class="field"><label>Cant.</label><input type="number" min="1" max="20" data-combo-qty value="'+esc(item.cantidad || 1)+'" required/></div>'+
          '<button type="button" data-combo-remove class="icon-button danger-text" aria-label="Quitar perfume"><i class="fa-solid fa-xmark"></i></button>'+
          '</div>';
    }
    function renderRows(lines) {
        $("comboComponentRows").innerHTML = lines.map(rowMarkup).join("");
    }
    function reset() {
        form.reset();
        $("comboId").value = "";
        $("comboFormTitle").textContent = "Nuevo combo";
        imageUrl = "";
        $("comboImage").value = "";
        $("comboImagePreview").hidden = true;
        $("comboImagePreview").removeAttribute("src");
        renderRows([{},{ }]);
        notify("");
    }
    function edit(combo) {
        $("comboId").value = combo.id;
        $("comboName").value = combo.nombre;
        $("comboDescription").value = combo.descripcion || "";
        $("comboPrice").value = combo.precio;
        $("comboPublished").checked = Boolean(combo.publicado);
        imageUrl = combo.imagenUrl || "";
        $("comboImage").value = "";
        $("comboImagePreview").hidden = !imageUrl;
        if (imageUrl) $("comboImagePreview").src = imageUrl;
        renderRows(combo.componentes.map(x => ({
            productoId:x.productoId, varianteId:x.varianteId, tipoItem:x.tipoItem, cantidad:x.cantidad
        })));
        $("comboFormTitle").textContent = "Editar " + combo.nombre;
        notify("");
        form.scrollIntoView({behavior:"smooth",block:"start"});
    }
    function renderList() {
        $("comboCount").textContent = combos.length + (combos.length === 1 ? " combo" : " combos");
        $("comboList").innerHTML = combos.length ? combos.map(combo => {
            const parts = (combo.componentes || []).map(x => esc(x.nombre)+" ("+esc(x.presentacion)+")").join(" · ");
            const img = combo.imagenUrl || combo.componentes?.[0]?.imagenUrl || "imagen/perfumes/perfume-default.png";
            return '<article class="admin-combo-card">'+
                '<img alt="" src="'+esc(img)+'"/><div class="admin-combo-info"><b>'+esc(combo.nombre)+'</b>'+
                '<p>'+parts+'</p><strong>'+esc(ParfumAPI.money(combo.precio))+'</strong>'+
                '<span class="status-pill '+(combo.publicado ? "active":"inactive")+'">'+
                  (combo.publicado ? "Publicado" : "Borrador")+'</span>'+
                '<small>'+esc(combo.stockEstimado)+' combo(s) estimados según stock de productos</small></div>'+
                '<div class="admin-combo-actions"><button type="button" class="secondary-btn" data-combo-edit="'+combo.id+'">Editar</button>'+
                '<button type="button" class="danger-btn" data-combo-delete="'+combo.id+'">Eliminar</button></div>'+
            '</article>';
        }).join("") : '<div class="empty-state admin-empty"><i class="fa-solid fa-gift"></i><p>Todavía no hay combos. Crea el primero usando los perfumes de tu catálogo.</p></div>';
    }
    async function load() {
        if (working) return;
        working = true;
        try {
            const [items, saved] = await Promise.all([
                ParfumAPI.request("/admin/productos"),
                ParfumAPI.request("/admin/combos")
            ]);
            catalog = items;
            combos = saved;
            renderList();
            if (!loaded) reset();
            loaded = true;
        } catch (error) {
            notify("No se pudieron cargar los combos: " + error.message);
        } finally { working = false; }
    }
    $("comboComponentRows").addEventListener("change", event => {
        const type = event.target.matches("[data-combo-type],[data-combo-product]");
        if (!type) return;
        const rows = readRows();
        const index = [...$("comboComponentRows").children].indexOf(event.target.closest("[data-combo-row]"));
        if (index < 0) return;
        rows[index].varianteId = "";
        renderRows(rows);
    });
    $("comboComponentRows").addEventListener("click", event => {
        if (!event.target.closest("[data-combo-remove]")) return;
        const rows = readRows();
        if (rows.length <= 2) { ParfumAPI.toast("Un combo necesita al menos dos componentes", "error"); return; }
        const index = [...$("comboComponentRows").children].indexOf(event.target.closest("[data-combo-row]"));
        rows.splice(index,1);
        renderRows(rows);
    });
    $("comboAddItem").addEventListener("click", () => {
        const rows = readRows();
        if (rows.length >= 12) return ParfumAPI.toast("Máximo 12 componentes por combo", "error");
        rows.push({});
        renderRows(rows);
    });
    $("comboReset").addEventListener("click",reset);
    $("comboImage").addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;
        if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8*1024*1024) {
            event.target.value = "";
            return notify("Usa una imagen JPG, PNG o WEBP de hasta 8 MB");
        }
        const preview = $("comboImagePreview");
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
        preview.onload = () => URL.revokeObjectURL(preview.src);
    });
    form.addEventListener("submit",async event => {
        event.preventDefault();
        if (working) return;
        const rows = readRows();
        if (rows.length < 2 || rows.some(x => !x.productoId || (!x.varianteId && x.tipoItem === "DECANT"))) {
            return notify("Selecciona al menos dos perfumes con sus presentaciones.");
        }
        const body = {
            nombre:$("comboName").value.trim(),
            descripcion:$("comboDescription").value.trim(),
            precio:Number($("comboPrice").value),
            publicado:$("comboPublished").checked,
            imagenUrl:imageUrl,
            componentes:rows.map(row => ({
                productoId:Number(row.productoId),
                varianteId:row.varianteId ? Number(row.varianteId) : null,
                tipoItem:row.tipoItem,
                cantidad:Number(row.cantidad)
            }))
        };
        if (!Number.isFinite(body.precio) || body.precio <= 0) return notify("Indica un precio válido para el combo");
        working = true;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const file = $("comboImage").files[0];
            if (file) {
                notify("Subiendo imagen del combo…","ok");
                const uploadBody = new FormData();
                uploadBody.append("file",file);
                const uploaded = await ParfumAPI.request("/imagenes/upload",{method:"POST",body:uploadBody});
                body.imagenUrl = uploaded.url;
            }
            const id = $("comboId").value;
            await ParfumAPI.request(id ? "/admin/combos/"+id : "/admin/combos", {
                method:id ? "PUT" : "POST",body
            });
            notify("Combo guardado correctamente","ok");
            ParfumAPI.toast("Combo guardado");
            working = false;
            reset();
            await load();
        } catch (error) {
            notify(error.message);
        } finally { working = false; button.disabled = false; }
    });
    $("comboList").addEventListener("click",async event => {
        const editButton = event.target.closest("[data-combo-edit]");
        if (editButton) {
            const found = combos.find(x => String(x.id) === editButton.dataset.comboEdit);
            if (found) edit(found);
            return;
        }
        const del = event.target.closest("[data-combo-delete]");
        if (!del) return;
        const combo = combos.find(x => String(x.id) === del.dataset.comboDelete);
        if (!combo || !confirm("¿Eliminar el combo " + combo.nombre + "? Los perfumes originales no se borrarán.")) return;
        del.disabled = true;
        try {
            await ParfumAPI.request("/admin/combos/"+combo.id,{method:"DELETE"});
            combos = combos.filter(x => x.id !== combo.id);
            renderList();
            if ($("comboId").value === String(combo.id)) reset();
            ParfumAPI.toast("Combo eliminado");
        } catch (error) { ParfumAPI.toast(error.message,"error"); }
        finally { del.disabled = false; }
    });
    document.addEventListener("parfum:load-combos",load);
    if (location.hash === "#combos") load();
})();

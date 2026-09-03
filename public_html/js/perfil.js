(() => {
    "use strict";
    if(!ParfumAPI.requireLogin())return;
    const msg=(id,text,type='ok')=>{const el=document.getElementById(id);el.textContent=text;el.className=`form-message ${type}`};
    async function load(){try{const u=await ParfumAPI.request('/usuarios/me');document.getElementById('name').value=u.nombre||'';document.getElementById('lastName').value=u.apellido||'';document.getElementById('email').value=u.email||'';document.getElementById('phone').value=u.telefono||'';document.getElementById('address').value=u.direccion||'';ParfumAPI.updateUser(u)}catch(e){msg('profileMessage',e.message,'error')}}
    document.getElementById('profileForm').onsubmit=async e=>{e.preventDefault();try{const u=await ParfumAPI.request('/usuarios/me',{method:'PUT',body:{nombre:document.getElementById('name').value,apellido:document.getElementById('lastName').value,telefono:document.getElementById('phone').value,direccion:document.getElementById('address').value}});ParfumAPI.updateUser(u);msg('profileMessage','Datos actualizados');ParfumAPI.toast('Perfil actualizado')}catch(err){msg('profileMessage',err.message,'error')}};
    document.getElementById('passwordForm').onsubmit=async e=>{e.preventDefault();try{await ParfumAPI.request('/usuarios/me/password',{method:'PUT',body:{actual:document.getElementById('currentPassword').value,nueva:document.getElementById('newPassword').value}});e.currentTarget.reset();msg('passwordMessage','Contraseña actualizada')}catch(err){msg('passwordMessage',err.message,'error')}};
    load();
})();

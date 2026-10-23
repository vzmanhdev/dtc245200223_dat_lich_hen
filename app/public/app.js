const $ = s => document.querySelector(s);
const csrf = () => $('meta[name="csrf-token"]').content;
let toastTimer;
function toast(message) { const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},5000); }
async function api(url,body) {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':csrf()},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({error:response.status===429?'Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.':'Không thể kết nối hệ thống.'}));
  if(!response.ok)throw new Error(data.error || 'Không thể thực hiện thao tác.');
  return data;
}
const dateFormat=v=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
const timeFormat=v=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
const statuses={pending:'Chờ xác nhận',confirmed:'Đã xác nhận',completed:'Hoàn thành',cancelled:'Đã hủy'};
function showError(selector,error) { const el=$(selector);el.textContent=error.message;el.hidden=false; }
if($('#booking-form')) {
  const service=$('#service-select'),date=$('#booking-date'),slot=$('#slot-select'),staff=$('#staff-select');
  const localDate=offset=>{const d=new Date(Date.now()+offset*86400000);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(k=>parts.find(x=>x.type===k).value).join('-');};
  date.min=localDate(0);date.max=localDate(365);date.value=date.min;
  let key=crypto.randomUUID().replaceAll('-',''),lastPayload='',loadNumber=0;
  async function loadSlots() {
    const number=++loadNumber;slot.disabled=true;slot.replaceChildren(new Option('Đang tìm khung giờ…',''));
    if(!service.value||!date.value||!staff.value){slot.replaceChildren(new Option('Chọn dịch vụ và ngày',''));return;}
    try {
      const response=await fetch(`/api/slots?serviceId=${encodeURIComponent(service.value)}&date=${encodeURIComponent(date.value)}&staffId=${encodeURIComponent(staff.value)}`,{headers:{Accept:'application/json'}});
      const data=await response.json();if(number!==loadNumber)return;
      if(!response.ok)throw new Error(data.error);
      slot.replaceChildren(new Option(data.length?'Chọn giờ phù hợp':'Ngày này chưa có giờ trống',''));
      data.forEach(s=>slot.add(new Option(`${timeFormat(s.start_at)} – ${timeFormat(s.end_at)}`,s.id)));
      slot.disabled=!data.length;
    }catch(e){if(number===loadNumber)slot.replaceChildren(new Option('Chưa tải được, hãy chọn lại',''));toast(e.message);}
  }
  let staffLoad=0;
  async function loadStaff(){
    const number=++staffLoad,selected=staff.value;staff.disabled=true;slot.disabled=true;slot.replaceChildren(new Option('Chọn dịch vụ, nhân viên và ngày',''));++loadNumber;
    if(!service.value){staff.replaceChildren(new Option('Chọn dịch vụ trước',''));return;}
    try{const response=await fetch('/api/staff?serviceId='+encodeURIComponent(service.value),{headers:{Accept:'application/json'}});const rows=await response.json();if(number!==staffLoad)return;if(!response.ok)throw new Error(rows.error);
      staff.replaceChildren(new Option(rows.length?'Chọn chuyên viên tư vấn':'Dịch vụ chưa có nhân viên phụ trách',''));rows.forEach(m=>staff.add(new Option(m.full_name,m.id)));staff.disabled=!rows.length;if(rows.some(m=>String(m.id)===selected))staff.value=selected;await loadSlots();
    }catch(error){toast(error.message);}
  }
  staff.disabled=true;staff.replaceChildren(new Option('Chọn dịch vụ trước',''));
  staff.addEventListener('change',loadSlots);service.addEventListener('change',loadStaff);date.addEventListener('change',loadSlots);
  document.querySelectorAll('.choose-service').forEach(button=>button.addEventListener('click',()=>{service.value=button.dataset.service;loadStaff();$('#booking').scrollIntoView({behavior:'smooth'});}));
  $('#booking-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');$('#booking-error').hidden=true;
    const body=Object.fromEntries(new FormData(form));delete body.date;delete body.serviceId;
    const current=JSON.stringify(body);if(lastPayload && current!==lastPayload)key=crypto.randomUUID().replaceAll('-','');lastPayload=current;body.idempotencyKey=key;
    button.disabled=true;button.textContent='Đang gửi yêu cầu…';
    try {
      const data=await api('/api/appointments',body);
      if(data.replayed){toast(data.message);await loadSlots();return;}
      $('#booking-code').textContent=data.bookingCode;
      $('#success-detail').textContent=`${data.serviceName} · ${data.staffName} · ${dateFormat(data.startAt)} – ${timeFormat(data.endAt)}`;
      $('#success-dialog').showModal();key=crypto.randomUUID().replaceAll('-','');lastPayload='';form.reset();date.value=date.min;await loadStaff();
    }catch(error){showError('#booking-error',error);await loadSlots();}
    finally{button.disabled=false;button.replaceChildren(document.createTextNode('Gửi yêu cầu đặt lịch ↗'));}
  });
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>$('#success-dialog').close()));
}
if($('#lookup-form')) {
  $('#lookup-form').addEventListener('submit',async event=>{
    event.preventDefault();$('#lookup-error').hidden=true;const target=$('#lookup-result');target.hidden=true;
    try {
      const token=$('#lookup-token').value.trim(),a=await api('/api/appointments/lookup',{token});
      target.replaceChildren();const code=document.createElement('strong');code.textContent=a.booking_code;const info=document.createElement('p');info.textContent=`${a.service_name} · ${dateFormat(a.start_at)}`;const badge=document.createElement('span');badge.className=`status ${a.status}`;badge.textContent=statuses[a.status];target.append(code,info,badge);
      if(['pending','confirmed'].includes(a.status)&&new Date(a.start_at)>new Date()) {
        const button=document.createElement('button');button.type='button';button.className='action-button cancel-booking';button.textContent='Hủy lịch hẹn';
        button.addEventListener('click',async()=>{if(!await confirmAction('Bạn muốn hủy lịch hẹn này?'))return;button.disabled=true;try{await api('/api/appointments/cancel',{token});badge.textContent=statuses.cancelled;badge.className='status cancelled';button.remove();toast('Đã hủy lịch hẹn.');}catch(error){toast(error.message);button.disabled=false;}});target.append(button);
      }
      target.hidden=false;
    }catch(error){showError('#lookup-error',error);}
  });
}
document.querySelectorAll('.row-actions button').forEach(button=>button.addEventListener('click',async()=>{
  const label=statuses[button.dataset.status];if(!await confirmAction(`Chuyển lịch hẹn sang “${label}”?`))return;
  button.disabled=true;
  try{await api(`/api/admin/appointments/${button.dataset.id}/status`,{status:button.dataset.status});location.reload();}catch(error){toast(error.message);button.disabled=false;}
}));

document.querySelectorAll('.cancel-owned').forEach(button=>button.addEventListener('click',async()=>{
 if(!await confirmAction('Bạn muốn hủy lịch hẹn này?'))return;
 button.disabled=true;
 try{await api(`/api/my/appointments/${button.dataset.id}/cancel`,{});location.reload();}catch(error){toast(error.message);button.disabled=false;}
}));

if(!$('#booking-form'))document.querySelectorAll('.choose-service').forEach(button=>button.addEventListener('click',()=>location.assign('/login')));

function confirmAction(message){
 const dialog=$('#confirm-dialog');$('#confirm-message').textContent=message;dialog.returnValue='cancel';dialog.showModal();
 return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
}
const savedMessage=sessionStorage.getItem('appointment-message');if(savedMessage){sessionStorage.removeItem('appointment-message');toast(savedMessage);}
document.querySelectorAll('.manage-form').forEach(form=>form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('[type=submit]'),error=form.querySelector('[data-form-error]'),data=new FormData(form),body=Object.fromEntries(data);error.hidden=true;
 if(form.querySelector('[name=active]'))body.active=form.querySelector('[name=active]').checked;
 if(form.querySelector('[name=serviceIds]'))body.serviceIds=data.getAll('serviceIds');
 button.disabled=true;
 try{const result=await api(form.getAttribute('action'),body);sessionStorage.setItem('appointment-message',result.message||'Đã lưu thay đổi.');location.assign(result.redirect||form.dataset.return||location.pathname);}catch(e){error.textContent=e.message;error.hidden=false;error.scrollIntoView({block:'nearest'});button.disabled=false;}
}));
document.querySelectorAll('.manage-action').forEach(button=>button.addEventListener('click',async()=>{
 button.disabled=true;if(!await confirmAction(button.dataset.confirm||'Thực hiện thao tác này?')){button.disabled=false;return;}
 try{const result=await api(button.dataset.url,button.dataset.open===undefined?{}:{isOpen:button.dataset.open==='true'});sessionStorage.setItem('appointment-message',result.message);location.reload();}catch(error){toast(error.message);button.disabled=false;}
}));

const slotAdminForm=document.querySelector('.manage-form[action^="/api/admin/slots"]');
if(slotAdminForm){
 const service=slotAdminForm.querySelector('[name=serviceId]'),staff=slotAdminForm.querySelector('[name=staffId]');let requestNumber=0;
 async function assignedStaff(){const number=++requestNumber,selected=staff.value;staff.disabled=true;staff.replaceChildren(new Option(service.value?'Đang tải nhân viên…':'Chọn dịch vụ trước',''));if(!service.value)return;
  try{const response=await fetch('/api/staff?serviceId='+encodeURIComponent(service.value),{headers:{Accept:'application/json'}});const rows=await response.json();if(number!==requestNumber)return;if(!response.ok)throw new Error(rows.error);staff.replaceChildren(new Option(rows.length?'Chọn nhân viên đã phân công':'Chưa có nhân viên phụ trách',''));rows.forEach(m=>staff.add(new Option(m.full_name,m.id)));staff.disabled=!rows.length;if(rows.some(m=>String(m.id)===selected))staff.value=selected;}catch(error){toast(error.message);}
 }
 service.addEventListener('change',assignedStaff);assignedStaff();
}

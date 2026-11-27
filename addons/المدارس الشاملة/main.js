const DB={
    async get(){
        let data=await Alaisai.get('school_sys');
        if(!data){
            data={school:{name:'مدرستي',admin:'المدير'},classes:[],students:[],works:[],messages:[]};
            await this.save(data);
        }
        return data;
    },
    async save(data){await Alaisai.set('school_sys',data)},
    async add(table,item){
        const db=await this.get();
        item.id=Date.now().toString();
        db[table].push(item);
        await this.save(db);
        return item;
    },
    async del(table,id){
        const db=await this.get();
        db[table]=db[table].filter(x=>x.id!==id);
        await this.save(db);
    }
};

const UI={
    toast(msg){
        const t=document.getElementById('toast');
        t.textContent=msg;
        t.classList.add('show');
        setTimeout(()=>t.classList.remove('show'),3000);
    },
    modal(title,content){
        const root=document.getElementById('modal-root');
        root.innerHTML=`<div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-header"><div class="modal-title">${title}</div><button class="btn-icon" onclick="UI.closeModal()">✕</button></div>${content}</div>`;
        root.classList.add('show');
        root.onclick=()=>UI.closeModal();
    },
    closeModal(){
        document.getElementById('modal-root').classList.remove('show');
        document.getElementById('modal-root').innerHTML='';
    }
};

const App={
    state:{view:'dashboard',classId:null},
    async init(){
        await this.renderShell();
        await this.navigate('dashboard');
    },
    async renderShell(){
        const db=await DB.get();
        document.getElementById('sidebar').innerHTML=`<div class="sidebar-brand">🏫 ${db.school.name}</div><div class="sidebar-nav"><button class="nav-item active" onclick="App.navigate('dashboard')">📊 الرئيسية</button><button class="nav-item" onclick="App.navigate('classes')">🏫 الفصول</button><button class="nav-item" onclick="App.navigate('students')">🎓 الطلاب</button><button class="nav-item" onclick="App.navigate('works')">📝 الواجبات</button><button class="nav-item" onclick="App.navigate('messages')">💬 الرسائل</button></div>`;
        document.getElementById('bottombar').innerHTML=`<div class="bottom-nav"><button class="bottom-item active" onclick="App.navigate('dashboard')"><span class="icon">📊</span>الرئيسية</button><button class="bottom-item" onclick="App.navigate('classes')"><span class="icon">🏫</span>الفصول</button><button class="bottom-item" onclick="App.navigate('students')"><span class="icon">🎓</span>الطلاب</button><button class="bottom-item" onclick="App.navigate('works')"><span class="icon">📝</span>الواجبات</button><button class="bottom-item" onclick="App.navigate('messages')"><span class="icon">💬</span>الرسائل</button></div>`;
    },
    async navigate(view,classId=null){
        this.state.view=view;
        this.state.classId=classId;
        document.getElementById('content').innerHTML='';
        if(view==='dashboard')await this.renderDashboard();
        else if(view==='classes')await this.renderClasses();
        else if(view==='students')await this.renderStudents();
        else if(view==='works')await this.renderWorks();
        else if(view==='messages')await this.renderMessages();
    },
    async renderDashboard(){
        const db=await DB.get();
        document.getElementById('topbar').innerHTML=`<h2>لوحة التحكم</h2>`;
        document.getElementById('content').innerHTML=`<div class="cards-grid"><div class="card"><h3>الفصول</h3><div class="value">${db.classes.length}</div></div><div class="card"><h3>الطلاب</h3><div class="value">${db.students.length}</div></div><div class="card"><h3>الواجبات</h3><div class="value">${db.works.length}</div></div><div class="card"><h3>الرسائل</h3><div class="value">${db.messages.length}</div></div></div><div class="header-actions"><h2>أحدث الطلاب</h2><button class="btn btn-primary" onclick="App.addStudent()">+ إضافة طالب</button></div><div class="list-container">${db.students.slice(-3).reverse().map(s=>{const cls=db.classes.find(c=>c.id===s.classId);return `<div class="list-item"><div class="list-item-info"><div class="list-item-title">${s.name}</div><div class="list-item-sub">${cls?cls.level:'غير محدد'}</div></div></div>`}).join('')||'<div style="padding:20px;text-align:center;color:gray">لا يوجد طلاب</div>'}</div>`;
    },
    async renderClasses(){
        const db=await DB.get();
        document.getElementById('topbar').innerHTML=`<h2>الفصول الدراسية</h2><button class="btn btn-primary" onclick="App.addClass()">+ إضافة فصل</button>`;
        let html='<div class="cards-grid">';
        if(db.classes.length===0){
            html+='<div style="grid-column:1/-1;text-align:center;padding:40px;color:gray">لا توجد فصول. أضف فصلك الأول.</div>';
        }else{
            db.classes.forEach(c=>{
                html+=`<div class="card" onclick="App.navigate('students','${c.id}')" style="cursor:pointer"><h3>${c.level}</h3><div class="value" style="font-size:18px">${c.shift}</div><div style="margin-top:10px;color:var(--text-muted);font-size:14px">طلاب: ${db.students.filter(s=>s.classId===c.id).length}</div></div>`;
            });
        }
        html+='</div>';
        document.getElementById('content').innerHTML=html;
    },
    async renderStudents(){
        const db=await DB.get();
        const st=this.state.classId?db.students.filter(s=>s.classId===this.state.classId):db.students;
        const cls=this.state.classId?db.classes.find(c=>c.id===this.state.classId):null;
        document.getElementById('topbar').innerHTML=`<h2>${cls?cls.level+' - '+cls.shift:'جميع الطلاب'}</h2><button class="btn btn-primary" onclick="App.addStudent()">+ إضافة طالب</button>`;
        let html='<div class="list-container">';
        if(st.length===0){
            html+='<div style="padding:20px;text-align:center;color:gray">لا يوجد طلاب.</div>';
        }else{
            st.forEach(s=>{
                const c=db.classes.find(c=>c.id===s.classId);
                html+=`<div class="list-item"><div class="list-item-info"><div class="list-item-title">${s.name}</div><div class="list-item-sub">${c?c.level+' - '+c.shift:'بدون فصل'}</div></div><div><button class="btn btn-outline btn-sm" onclick="App.studentProfile('${s.id}')">الملف</button></div></div>`;
            });
        }
        html+='</div>';
        document.getElementById('content').innerHTML=html;
    },
    async renderWorks(){
        const db=await DB.get();
        document.getElementById('topbar').innerHTML=`<h2>الواجبات</h2><button class="btn btn-primary" onclick="App.addWork()">+ واجب جديد</button>`;
        let html='<div class="list-container">';
        if(db.works.length===0){
            html+='<div style="padding:20px;text-align:center;color:gray">لا توجد واجبات.</div>';
        }else{
            db.works.forEach(w=>{
                const c=db.classes.find(c=>c.id===w.classId);
                html+=`<div class="list-item"><div class="list-item-info"><div class="list-item-title">${w.title}</div><div class="list-item-sub">${w.subject} - ${c?c.level:'غير محدد'} - ${w.date}</div></div></div>`;
            });
        }
        html+='</div>';
        document.getElementById('content').innerHTML=html;
    },
    async renderMessages(){
        document.getElementById('topbar').innerHTML=`<h2>الرسائل</h2>`;
        document.getElementById('content').innerHTML=`<div style="text-align:center;padding:40px;color:gray">قسم الرسائل قيد التطوير...</div>`;
    },
    addClass(){
        UI.modal('إضافة فصل جديد',`<div class="form-group"><label>الصف الدراسي</label><select id="cls-level" class="form-control"><option value="الصف الأول">الصف الأول</option><option value="الصف الثاني">الصف الثاني</option><option value="الصف الثالث">الصف الثالث</option><option value="الصف الرابع">الصف الرابع</option><option value="الصف الخامس">الصف الخامس</option><option value="الصف السادس">الصف السادس</option><option value="الأول ثانوي">الأول ثانوي</option><option value="الثاني ثانوي">الثاني ثانوي</option><option value="الثالث ثانوي">الثالث ثانوي</option></select></div><div class="form-group"><label>الفترة</label><select id="cls-shift" class="form-control"><option value="صباحي">صباحي</option><option value="مسائي">مسائي</option></select></div><button class="btn btn-primary" onclick="App.saveClass()" style="width:100%">حفظ</button>`);
    },
    async saveClass(){
        const level=document.getElementById('cls-level').value;
        const shift=document.getElementById('cls-shift').value;
        await DB.add('classes',{level,shift});
        UI.closeModal();
        UI.toast('تم إضافة الفصل');
        await this.navigate('classes');
    },
    async addStudent(){
        const db=await DB.get();
        if(db.classes.length===0)return UI.toast('أضف فصلاً أولاً');
        let options=db.classes.map(c=>`<option value="${c.id}">${c.level} - ${c.shift}</option>`).join('');
        UI.modal('إضافة طالب',`<div class="form-group"><label>اسم الطالب</label><input type="text" id="std-name" class="form-control" placeholder="الاسم الكامل"></div><div class="form-group"><label>الفصل</label><select id="std-class" class="form-control">${options}</select></div><div class="form-group"><label>رقم ولي الأمر</label><input type="tel" id="std-phone" class="form-control" placeholder="77xxxxxxx"></div><button class="btn btn-primary" onclick="App.saveStudent()" style="width:100%">حفظ</button>`);
    },
    async saveStudent(){
        const name=document.getElementById('std-name').value;
        const classId=document.getElementById('std-class').value;
        const phone=document.getElementById('std-phone').value;
        if(!name)return UI.toast('أدخل اسم الطالب');
        await DB.add('students',{name,classId,phone});
        UI.closeModal();
        UI.toast('تم إضافة الطالب');
        await this.navigate('students',this.state.classId);
    },
    async studentProfile(id){
        const db=await DB.get();
        const s=db.students.find(x=>x.id===id);
        UI.modal(`ملف الطالب: ${s.name}`,`<div style="display:flex;gap:10px;margin-bottom:20px"><button class="btn btn-primary" style="flex:1">الدرجات</button><button class="btn btn-outline" style="flex:1">الواجبات</button><button class="btn btn-outline" style="flex:1">مراسلة</button></div><div class="form-group"><label>رفع ملف أو صورة (شهادة/هوية)</label><input type="file" class="form-control"></div><div class="form-group"><label>أو التقاط صورة بالكاميرا</label><input type="file" accept="image/*" capture="environment" class="form-control"></div><button class="btn btn-primary" style="width:100%;margin-top:10px">حفظ المرفقات</button><hr style="margin:20px 0;border:none;border-top:1px solid var(--border)"><button class="btn btn-danger" style="width:100%" onclick="App.delStudent('${s.id}')">حذف الطالب</button>`);
    },
    async delStudent(id){
        if(confirm('هل أنت متأكد من الحذف؟')){
            await DB.del('students',id);
            UI.closeModal();
            UI.toast('تم الحذف');
            await this.navigate('students',this.state.classId);
        }
    },
    async addWork(){
        const db=await DB.get();
        if(db.classes.length===0)return UI.toast('أضف فصلاً أولاً');
        let options=db.classes.map(c=>`<option value="${c.id}">${c.level} - ${c.shift}</option>`).join('');
        UI.modal('إضافة واجب',`<div class="form-group"><label>عنوان الواجب</label><input type="text" id="w-title" class="form-control"></div><div class="form-group"><label>المادة</label><input type="text" id="w-subject" class="form-control" placeholder="رياضيات"></div><div class="form-group"><label>الفصل</label><select id="w-class" class="form-control">${options}</select></div><div class="form-group"><label>التفاصيل / الملفات</label><textarea id="w-desc" class="form-control" rows="3"></textarea></div><div class="form-group"><label>إرفاق ملف أو صورة</label><input type="file" class="form-control"></div><button class="btn btn-primary" onclick="App.saveWork()" style="width:100%">نشر الواجب</button>`);
    },
    async saveWork(){
        const title=document.getElementById('w-title').value;
        const subject=document.getElementById('w-subject').value;
        const classId=document.getElementById('w-class').value;
        const desc=document.getElementById('w-desc').value;
        if(!title)return UI.toast('أدخل العنوان');
        await DB.add('works',{title,subject,classId,desc,date:new Date().toLocaleDateString('ar-EG')});
        UI.closeModal();
        UI.toast('تم نشر الواجب');
        await this.navigate('works');
    }
};

App.init();

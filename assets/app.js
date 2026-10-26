import { validateBank, normalizeBank, fingerprint, createDraft, draftState, prepareImport } from './core.mjs';
import { SITE_CONFIG, getLearningSummary, getNextPracticeId } from './notebook.mjs';

const $ = selector => document.querySelector(selector);
const clone = value => JSON.parse(JSON.stringify(value));
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scope = new URL('.', location.href).pathname;
const DRAFT_KEY = `interview-bank:${scope}:drafts-v1`;
const PROGRESS_KEY = `interview-bank:${scope}:progress-v1`;
const LEGACY_KEYS = ['interview-bank-2026-10-20-v10-nested','interview-bank-2026-10-19-v9-nested','interview-bank-2026-10-15-v8-nested','interview-bank-2026-10-15-v7-nested','interview-bank-2026-10-15-v6-skills','interview-bank-2026-10-15-v5','interview-bank-2026-10-14-v4'];
let BASE, TAX, SKILLS, CATS, GROUPS, LOOKUP, items;
let drafts = {}, progress = {favorites:{},practiced:{}}, loadedDraftRaw = null;
let canPersist = true, storageMessage = '', legacyItems = [], loadedAt = '';
let selectedCat='A', selectedGroup='A_C', expandedCat='A', expandedGroup=null, showTags=true, onlyQuestions=false, openSet=new Set();
let hiddenSet=new Set(), draftView=new Set(), viewFilter='all', pendingImport=null, compareId=null;
let editorOpen=false, lastModalFocus=null, editorDirty=false, lastSearch='';
let unreadLocalState={};
let confirmationResolve=null;
const mobileNav = matchMedia('(max-width: 860px)');
function orderedItems() { return TAX.flatMap(cat=>cat.groups.flatMap(group=>group.ids.map(id=>LOOKUP.get(id)).filter(Boolean))); }
function applyBranding() {
  document.title=SITE_CONFIG.name+'｜'+SITE_CONFIG.section;
  for(const [selector,value] of [['[data-brand-name]',SITE_CONFIG.name],['[data-brand-subtitle]',SITE_CONFIG.subtitle],['[data-section-name]',SITE_CONFIG.section]]) document.querySelectorAll(selector).forEach(el=>el.textContent=value);
}
function renderOverview() {
  const ordered=orderedItems(), summary=getLearningSummary(ordered,progress), next=getNextPracticeId(ordered,progress);
  for(const [id,value] of [['overviewTotal',summary.total],['overviewPracticed',summary.practiced],['overviewFavorites',summary.favorites]]) {const el=document.getElementById(id);if(el)el.textContent=value;}
  if($('#overviewProgress')) {$('#overviewProgress').max=100;$('#overviewProgress').value=summary.completion;$('#overviewProgress').setAttribute('aria-label',`练习进度 ${summary.completion}%`);}
  if($('#continuePractice')) {$('#continuePractice').textContent=next?'继续练习':'重新复习';$('#continuePractice').disabled=!ordered.length;}
  if($('#continueHint')) $('#continueHint').textContent=next?`下一题 ${next} · ${LOOKUP.get(next).title}`:ordered.length?'这一轮已全部练过，随时可以再复习一次。':'题库暂时没有题目。';
}
function setNavigationOpen(open, returnFocus=false) {
  const body=$('#navBody'), toggle=$('#navToggle');if(!body||!toggle)return;
  if(!open && (returnFocus||body.contains(document.activeElement))) toggle.focus({preventScroll:true});
  body.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
}
function closeMobileNavigation(returnFocus=false) {if(mobileNav.matches)setNavigationOpen(false,returnFocus);}
function focusAction(attribute,id) {
  const button=document.querySelector(`[data-${attribute}="${CSS.escape(id)}"]`);
  (button||$('#filters [data-filter="'+viewFilter+'"]'))?.focus({preventScroll:true});
}
const safeId=id=>/^(?:[ABC]\d{2,}|D\d{2,}-\d{2,})$/.test(id);
function validProgress(value) {
  return value && ['favorites','practiced'].every(key=>value[key] && typeof value[key]==='object' && !Array.isArray(value[key]))
    && Object.entries(value.favorites).every(([id,flag])=>safeId(id)&&typeof flag==='boolean')
    && Object.entries(value.practiced).every(([id,date])=>safeId(id)&&typeof date==='string'&&Number.isFinite(Date.parse(date)));
}

function notice(message, error=false) {
  $('#notice').textContent=message;
  $('#notice').className=error?'storage-error':'';
}

function loadLocalState() {
  try {
    loadedDraftRaw=localStorage.getItem(DRAFT_KEY);
    if(loadedDraftRaw) {
      const value=JSON.parse(loadedDraftRaw);
      if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('草稿备份格式不正确');
      for(const [id,draft] of Object.entries(value)) {
        if(!/^(?:[ABC]\d{2,}|D\d{2,}-\d{2,})$/.test(id) || draft?.item?.id!==id || !Array.isArray(draft.item.parts) || !draft.item.parts.every(p=>typeof p?.tag==='string' && typeof p?.text==='string') || !Array.isArray(draft.item.skills) || typeof draft.item.title!=='string' || !(typeof draft.baseFingerprint==='string' || draft.baseFingerprint===null)) throw Error('草稿记录格式不正确');
        if(!draft.item.parts.length || draft.item.parts.some(p=>!p.tag.trim()||!p.text.trim()) || draft.item.skills.some(k=>typeof k!=='string') || ['logic','note','data','state'].some(k=>typeof draft.item[k]!=='string')) throw Error('草稿内容格式不正确');
      }
      drafts=value;
    }
    const savedProgress=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');
    if(savedProgress) {
      if(!validProgress(savedProgress)) throw Error('练习备份格式不正确');
      progress=savedProgress;
    }
    for(const key of LEGACY_KEYS) {
      const old=JSON.parse(localStorage.getItem(key)||'{}');
      for(const [id,value] of Object.entries(old||{})) if(LOOKUP.has(id) && value?.id===id && !legacyItems.some(q=>q.id===id)) legacyItems.push(value);
    }
  } catch(error) {
    canPersist=false;
    try {unreadLocalState={draftsRaw:localStorage.getItem(DRAFT_KEY),progressRaw:localStorage.getItem(PROGRESS_KEY)};}catch{}
    storageMessage='本地存储无法读取或格式异常。原存储未被清空；本次修改仅暂存在内存中，请导出完整备份。';
  }
}

// Compare the stored value before each write so another tab's draft is never lost.
async function persistDrafts(next) {
  if(canPersist && navigator.locks) return navigator.locks.request(DRAFT_KEY,()=>writeDrafts(next));
  if(canPersist) {canPersist=false;storageMessage='当前浏览器不支持安全的多标签页草稿保存，本次修改暂存在内存中，请导出备份。';}
  return writeDrafts(next);
}
function writeDrafts(next) {
  if(canPersist) {
    try {
      if(localStorage.getItem(DRAFT_KEY)!==loadedDraftRaw) {
        notice('另一标签页已修改草稿。本次未保存，请先复制编辑内容或导出备份，再刷新读取最新草稿。',true);
        return false;
      }
      const raw=JSON.stringify(next);
      localStorage.setItem(DRAFT_KEY,raw);
      loadedDraftRaw=raw;
    } catch(error) {
      canPersist=false;
      storageMessage='浏览器未能保存本地数据。本次草稿只暂存在内存中，请立即导出完整备份。';
      notice(storageMessage,true);
    }
  }
  drafts=next;
  return true;
}

async function persistProgress(update) {
  const write=()=>{
    try {
      if(canPersist) {
        const latest=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');
        if(latest && !validProgress(latest)) throw Error('练习备份格式不正确');
        if(latest) progress=latest;
      }
      update(progress);
      if(canPersist) localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));
    } catch(error) {canPersist=false;try{unreadLocalState.progressRaw=localStorage.getItem(PROGRESS_KEY);}catch{}storageMessage='收藏和练习记录暂存在内存中，请导出完整备份。';}
  };
  if(canPersist && navigator.locks) await navigator.locks.request(PROGRESS_KEY,write);
  else {if(canPersist){canPersist=false;storageMessage='浏览器不支持安全本地保存，请导出备份。';}write();}
}

function get(id) {
  const formal=LOOKUP.get(id);
  if(!draftView.has(id)||!drafts[id])return formal;
  const local=drafts[id].item;
  // Keep an older draft navigable after published categories or skills evolve.
  const skills=local.skills.filter(k=>SKILLS[k]);
  const primarySkill=SKILLS[local.primarySkill]?local.primarySkill:formal.primarySkill;
  if(!skills.includes(primarySkill))skills.unshift(primarySkill);
  return {...local,kind:formal.kind,navGroup:formal.navGroup,skills,primarySkill};
}
function catOf(q) { return q.id.slice(0,1); }
function matchText(q,term) {
  return [q.id,q.title,q.story,q.mother,q.state,q.related,q.data,q.note,q.logic,GROUPS[q.navGroup]?.title,CATS[catOf(q)]?.title,...(q.parts||[]).map(p=>p.text),...(q.skills||[]).map(k=>SKILLS[k]?.name||'')].join(' ').toLowerCase().includes(term.toLowerCase());
}
function selection() {
  const term=$('#search').value.trim();
  let visible=BASE.items.map(q=>get(q.id));
  if(term) visible=visible.filter(q=>matchText(q,term));
  else if(viewFilter==='all') visible=selectedGroup?GROUPS[selectedGroup].ids.map(get).filter(Boolean):[];
  if(viewFilter==='favorites') visible=visible.filter(q=>progress.favorites[q.id]);
  if(viewFilter==='practiced') visible=visible.filter(q=>progress.practiced[q.id]);
  if(viewFilter==='drafts') visible=visible.filter(q=>drafts[q.id]);
  return visible;
}

function renderSync() {
  const entries=Object.entries(drafts);
  const conflicts=entries.filter(([id,draft])=>draftState(draft,LOOKUP.get(id))==='conflict');
  const orphans=entries.filter(([id])=>!LOOKUP.has(id));
  if($('#syncSummary')) $('#syncSummary').textContent=`正式内容已读取 · 本地草稿 ${entries.length} 题${conflicts.length?' · 有版本冲突':''}${legacyItems.length?` · 旧版草稿 ${legacyItems.length} 题待迁移`:''}`;
  const details=$('#syncStatus').closest('details');if(details&&(conflicts.length||orphans.length||legacyItems.length||!canPersist))details.open=true;
  $('#syncStatus').className='sync-panel'+(conflicts.length||orphans.length||!canPersist?' warning':'');
  $('#syncStatus').innerHTML=`<b>正式内容已读取</b> · ${escapeHTML(loadedAt)}<br>数据版本：${escapeHTML(BASE.version)} · ${BASE.items.length}题。<br>本地草稿 ${entries.length} 题，冲突 ${conflicts.length} 题${orphans.length?`，已不在正式库中的草稿 ${orphans.length} 题（仍保留于备份）`:''}。刷新默认显示正式版。${storageMessage?`<p class="storage-error">${escapeHTML(storageMessage)}</p>`:''}${conflicts.length?`<p>正式内容有变化，请逐题对比：${conflicts.map(([id])=>`<button class="smallbtn" data-compare="${id}">${id} 对比版本</button>`).join('')}</p>`:''}${legacyItems.length?`<p>检测到旧版浏览器编辑，尚未应用。<button class="smallbtn" id="legacyImport">预览迁移 ${legacyItems.length} 题旧草稿</button></p>`:''}`;
}

function cardHTML(q) {
  const deep=q.kind==='deep', opened=deep?openSet.has(q.id):!hiddenSet.has(q.id);
  const draft=drafts[q.id], state=draftState(draft,LOOKUP.get(q.id)), local=draftView.has(q.id);
  const tags=(q.skills||[]).slice(0,4).map(k=>`<span class="tag ${q.primarySkill===k?'main-tag':'cross'}">${escapeHTML(SKILLS[k]?.short)}</span>`).join('');
  const keys=q.kind==='main'?q.deepRefs||[]:(q.related||'').split('/').map(x=>x.trim()).filter(Boolean);
  const links=keys.filter(id=>LOOKUP.has(id));
  return `<article class="card" id="${q.id}"><div class="chead"><h3 tabindex="-1"><span class="cid">${q.id}</span>${escapeHTML(q.title)}</h3><button class="smallbtn" data-expand="${q.id}" aria-controls="answer-${q.id}" aria-expanded="${opened&&!onlyQuestions}">${opened&&!onlyQuestions?'收起回答':'查看回答'}</button></div><div class="tags"><span class="tag main-tag">${escapeHTML(GROUPS[q.navGroup]?.title||'')}</span>${tags}<span class="tag">${escapeHTML(q.story||'')}</span><span class="tag ${q.state!=='可练'?'warn':''}">${escapeHTML(q.state||'待完善')}</span></div><p class="draft-label ${local?'':'formal'}">${local?'正在查看本地草稿 · 未同步 GitHub':'正在查看正式版'}${draft?` · 有本地草稿（${escapeHTML(draft.updatedAt||'导入时间未知')}）`:''}</p>${state==='conflict'?'<div class="draft-warning">正式内容自这份草稿建立后已变化。草稿尚未覆盖正式版，请先对比版本。</div>':''}<div class="progress-actions"><button class="smallbtn" data-favorite="${q.id}" aria-pressed="${!!progress.favorites[q.id]}">${progress.favorites[q.id]?'★ 已收藏':'☆ 收藏'}</button><button class="smallbtn" data-practice="${q.id}" aria-pressed="${!!progress.practiced[q.id]}">${progress.practiced[q.id]?'✓ 已练习':'标记已练习'}</button></div>${draft?`<div class="draft-tools"><button class="smallbtn" data-compare="${q.id}">对比正式版与草稿</button><button class="smallbtn" data-published="${q.id}">查看正式版</button><button class="smallbtn" data-local="${q.id}">查看本地草稿</button><button class="smallbtn" data-discard="${q.id}">删除这题本地草稿</button></div>`:''}<div id="answer-${q.id}" class="answer ${onlyQuestions||!opened?'hidden':''}">${q.parts.map((p,i)=>`<div class="part ${/^(?:Part\b|版本)/i.test(p.tag.trim())?'version-part':''}"><div class="part-head ${showTags?'':'hidden'}"><span class="part-number">${String(i+1).padStart(2,'0')}</span><span class="part-title">${escapeHTML(p.tag)}</span></div><p class="part-text">${escapeHTML(p.text)}</p></div>`).join('')}<details class="detail"><summary>查看答题逻辑／表达提醒／数据口径</summary><div class="detail-block"><b>答题逻辑：</b>${escapeHTML(q.logic||'')}</div><div class="detail-block"><b>表达提醒：</b>${escapeHTML(q.note||'')}</div><div class="detail-block"><b>数据口径：</b>${escapeHTML(q.data||'')}</div></details>${links.length?`<div class="related"><span class="related-label">${deep?'关联主问题':'关联简历深挖'}：</span>${links.map(id=>`<a href="#${id}" class="linkpill" data-goto="${id}">${id}</a>`).join('')}</div>`:''}</div><div class="card-actions"><button class="smallbtn" data-edit="${q.id}">编辑本地草稿</button><button class="smallbtn" data-copy="${q.id}">复制口语稿</button></div><div class="edittarget"></div></article>`;
}

function render() {
  const term=$('#search').value.trim(), visible=selection(), c=CATS[selectedCat], g=GROUPS[selectedGroup];
  const global=!!term||viewFilter!=='all';
  const filterNames={all:'全部题目',favorites:'我的收藏',practiced:'已练习',drafts:'本地草稿'};
  renderNav(); renderSync(); renderOverview();
  if($('#mobileCurrentGroup')) $('#mobileCurrentGroup').textContent=global?'全部题库':g?.title||c.title;
  $('#headnum').textContent=`${BASE.items.filter(q=>q.kind==='main').length} 主问题 · ${BASE.items.filter(q=>q.kind==='deep').length} 追问 · 共${BASE.items.length}题`;
  $('#crumb').textContent=global?'全部题库 / '+(term?'搜索结果':filterNames[viewFilter]):`${selectedCat}｜${c.title}${g?' / '+g.title:''}`;
  $('#currentTitle').textContent=term?'搜索：'+term:global?filterNames[viewFilter]:g?.title||c.title;
  $('#currentDesc').textContent=global?`在全部 ${BASE.items.length} 题中筛选，当前显示 ${visible.length} 题。`:c.desc;
  $('#metrics').innerHTML=`<span class="metric"><b>${visible.filter(q=>q.kind==='main').length}</b> 道主问题</span><span class="metric"><b>${visible.filter(q=>q.kind==='deep').length}</b> 道深挖追问</span><span class="metric"><b>${BASE.items.length}</b> 道总库存</span>`;
  $('#toggleTags').textContent=showTags?'隐藏结构标签':'显示结构标签';
  $('#toggleAnswers').textContent=onlyQuestions?'显示回答':'只看问题';
  $('#status').textContent=`当前显示 ${visible.length} 题。网页编辑保存为本地草稿；更新正式答案请通过 GitHub 提交 questions.json。`;
  $('#filters').querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===viewFilter)));
  let out=[];
  if(global) {
    if(!visible.length) out.push('<div class="empty">没有找到匹配的问题。</div>');
    for(const cat of TAX) {
      const found=visible.filter(q=>catOf(q)===cat.id);
      if(!found.length) continue;
      out.push(`<div class="section-title"><h3>${cat.id}｜${escapeHTML(cat.title)}</h3><p>${found.length}题</p></div>`);
      for(const group of cat.groups) {
        const selected=found.filter(q=>q.navGroup===group.id);
        if(selected.length) out.push(`<p class="small-rule">${escapeHTML(group.title)} · ${selected.length}题</p>`+selected.map(cardHTML).join(''));
      }
    }
  } else if(!selectedGroup) out.push('<div class="category-tiles">'+c.groups.map(x=>`<button class="category-tile" data-group="${x.id}"><div class="t-title">${escapeHTML(x.title)}</div><div class="t-meta">${x.ids.length}道题 · 点击进入</div></button>`).join('')+'</div>');
  else out.push(visible.map(cardHTML).join(''));
  $('#content').innerHTML=out.join('');
  editorOpen=false;editorDirty=false;lastSearch=term;
}

async function saveEditor(id) {
  const el=document.querySelector('#'+CSS.escape(id)+' .editor');
  if(!el) return;
  const original=drafts[id]?.item||LOOKUP.get(id), q=clone(original);
  const value=name=>el.querySelector(`[name="${name}"]`)?.value.trim()||'';
  q.title=value('title'); q.parts=q.parts.map((part,i)=>({...part,tag:value('tag'+i),text:value('part'+i)}));
  for(const key of ['logic','note','data','state']) q[key]=value(key);
  q.primarySkill=value('primarySkill'); q.skills=Object.keys(SKILLS).filter(k=>el.querySelector(`[name="sk-${k}"]`)?.checked);
  if(!q.skills.includes(q.primarySkill)) q.skills.unshift(q.primarySkill);
  q.kind=LOOKUP.get(id).kind;q.navGroup=LOOKUP.get(id).navGroup;
  const check=validateBank({...BASE,items:BASE.items.map(item=>item.id===id?q:item)});
  if(check.errors.length) {notice('草稿未保存：'+check.errors.join('；'),true);return;}
  const draft=createDraft(q,LOOKUP.get(id));
  if(drafts[id] && draftState(drafts[id],LOOKUP.get(id))==='conflict') draft.baseFingerprint=drafts[id].baseFingerprint;
  if(!await persistDrafts({...drafts,[id]:draft})) return;
  draftView.add(id); render(); notice(canPersist?'本地草稿已保存，未同步 GitHub。':storageMessage,!canPersist);
  document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
}

function backup() {
  return {...clone(BASE),localState:{formatVersion:1,exportedAt:new Date().toISOString(),drafts:clone(drafts),progress:clone(progress),...(Object.keys(unreadLocalState).length?{unreadLocalState}:{}),unsavedEditors:[...document.querySelectorAll('.editor')].map(editor=>({id:editor.closest('.card').id,fields:[...editor.querySelectorAll('input,textarea,select')].map(field=>({name:field.name,value:field.value,...(field.type==='checkbox'?{checked:field.checked}:{})}))}))}};
}
function exportBackup() { download(JSON.stringify(backup(),null,2),SITE_CONFIG.name+'_正式内容与本地备份.json','application/json;charset=utf-8'); }
function mdExport() {
  const lines=['# '+SITE_CONFIG.name+' · '+SITE_CONFIG.section,'','> 正式内容与当前明确选择查看的本地草稿。草稿未同步 GitHub。',''];
  for(const cat of TAX) for(const group of cat.groups) {
    lines.push(`## ${cat.id}｜${cat.title} / ${group.title}`,'');
    for(const id of group.ids) {
      const q=get(id);lines.push(`### ${q.id}｜${q.title}${draftView.has(id)?'【本地草稿】':''}`,'');
      for(const part of q.parts) lines.push(`**【${part.tag}】**`,part.text,'');
      lines.push('**答题逻辑：** '+(q.logic||''),'**表达提醒：** '+(q.note||''),'**数据口径：** '+(q.data||''),'**状态：** '+(q.state||''),'','---','');
    }
  }
  return lines.join('\n');
}

function openModal(id) { lastModalFocus=document.activeElement;if($('#appShell'))$('#appShell').inert=true;$(id).classList.remove('hidden');$(id).querySelector('button,input,textarea')?.focus(); }
function closeModal(id) { $(id).classList.add('hidden');if($('#appShell'))$('#appShell').inert=false;lastModalFocus?.focus(); }
function askConfirm(message) {
  $('#confirmMessage').textContent=message;openModal('#confirmback');
  $('#confirmCancel').focus();
  return new Promise(resolve=>{confirmationResolve=resolve;});
}
function finishConfirm(approved) {
  closeModal('#confirmback');const resolve=confirmationResolve;confirmationResolve=null;resolve?.(approved);
}
function openImport() { pendingImport=null;$('#importPreview').textContent='';$('#importApply').textContent='预览导入';openModal('#modalback'); }
function stageImport(value) {
  const result=prepareImport(value,BASE,drafts);
  let importedProgress=null;
  if(value?.localState?.progress) {
    importedProgress=clone(value.localState.progress);
    if(!validProgress(importedProgress)) throw Error('收藏或练习记录格式不正确');
  }
  pendingImport={...result,progress:importedProgress,expectedRaw:loadedDraftRaw};
  const changed=Object.keys(result.drafts).filter(id=>fingerprint(result.drafts[id])!==fingerprint(drafts[id]||null));
  $('#importPreview').textContent=`将新增或更新 ${changed.length} 份本地草稿（${changed.join('、')||'无'}）。${result.conflicts.length?`其中 ${result.conflicts.join('、')} 将替换已有本地草稿，请先导出备份。`:''} 忽略未知题号 ${result.ignored.length} 个。${importedProgress?'将合并收藏和练习记录。':''}正式题库不会修改。`;
  $('#importApply').textContent='确认导入为本地草稿';
}
async function doImport() {
  try {
    if(!pendingImport) {
      const file=$('#importfile').files[0];
      stageImport(JSON.parse(file?await file.text():$('#importarea').value.trim()));
      return;
    }
    if(pendingImport.expectedRaw!==loadedDraftRaw) throw Error('草稿在预览后发生变化，请重新预览导入。');
    if(!await persistDrafts(pendingImport.drafts)) return;
    if(pendingImport.progress) {
      await persistProgress(current=>{current.favorites={...current.favorites,...pendingImport.progress.favorites};current.practiced={...current.practiced,...pendingImport.progress.practiced};});
    }
    closeModal('#modalback');$('#importfile').value='';$('#importarea').value='';pendingImport=null;draftView.clear();render();
    notice('已导入本地草稿。当前仍显示正式版，请通过“本地草稿”逐题对比后选择。');
  } catch(error) {$('#importPreview').textContent='导入未执行：'+error.message;pendingImport=null;$('#importApply').textContent='预览导入';}
}

function questionText(q) {
  if(!q) return '这道题已不在正式题库中。';
  return [q.title,'',...q.parts.flatMap(p=>['【'+p.tag+'】',p.text,'']),'答题逻辑：'+(q.logic||''),'备注：'+(q.note||''),'数据口径：'+(q.data||''),'状态：'+(q.state||''),'主能力：'+(q.primarySkill||''),'关联能力：'+(q.skills||[]).join(' / ')].join('\n');
}
function compare(id) {
  if(!drafts[id]) return;
  compareId=id;$('#compareTitle').textContent=id+'｜正式版与本地草稿';
  $('#compareContent').innerHTML=`<section><h4>最新发布的正式版</h4><pre>${escapeHTML(questionText(LOOKUP.get(id)))}</pre></section><section><h4>本地草稿 · 未同步 GitHub</h4><pre>${escapeHTML(questionText(drafts[id].item))}</pre></section>`;
  openModal('#compareback');
}

async function boot() {
  const url=new URL('./questions.json',location.href);
  url.searchParams.set('_fresh',Date.now()+'-'+Math.random().toString(36).slice(2));
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok) throw Error('读取 questions.json 失败：HTTP '+response.status);
  const bank=await response.json(), check=validateBank(bank);
  if(check.errors.length) throw Error('题库校验失败：'+check.errors.join('；'));
  BASE=normalizeBank(bank);TAX=BASE.taxonomy;SKILLS=BASE.skillCategories;
  CATS=Object.fromEntries(TAX.map(c=>[c.id,c]));
  GROUPS=Object.fromEntries(TAX.flatMap(c=>c.groups.map(g=>[g.id,{...g,category:c.id}])));
  items=BASE.items;LOOKUP=new Map(items.map(q=>[q.id,q]));
  if(!GROUPS[selectedGroup]) selectedGroup=TAX[0].groups[0]?.id||null;
  expandedGroup=selectedGroup;
  loadedAt=new Date().toLocaleString('zh-CN',{hour12:false});loadLocalState();bindEvents();render();
  if(location.hash && LOOKUP.has(location.hash.slice(1))) jumpTo(location.hash.slice(1));
}

function bindEvents() {
  setNavigationOpen(!mobileNav.matches);
  mobileNav.addEventListener('change',()=>setNavigationOpen(!mobileNav.matches));
  $('#navToggle')?.addEventListener('click',()=>setNavigationOpen($('#navToggle').getAttribute('aria-expanded')!=='true'));
  $('#continuePractice')?.addEventListener('click',()=>{const ordered=orderedItems(),id=getNextPracticeId(ordered,progress)||ordered[0]?.id;if(id){viewFilter='all';jumpTo(id);}});

  $('#search').addEventListener('input',()=>{
    if(editorDirty){$('#search').value=lastSearch;notice('请先保存或取消当前编辑，再搜索其他题目；编辑内容已保留。',true);return;}
    render();
  });
  document.addEventListener('input',event=>{if(event.target.closest('.editor'))editorDirty=true;});
  document.addEventListener('change',event=>{if(event.target.closest('.editor'))editorDirty=true;});
  // Rendering replaces cards. Keep unsaved input intact until the user saves or cancels.
  document.addEventListener('click',event=>{
    const action=event.target.closest('button,a[data-goto]');
    if(!editorDirty||!action||action.closest('.editor')||['exportjson','exportmd','navToggle'].includes(action.id))return;
    if(action.closest('#modalback,#compareback,#confirmback'))return;
    event.preventDefault();event.stopImmediatePropagation();
    notice('当前编辑尚未保存，请先保存为本地草稿或取消编辑；输入内容已保留。',true);
  },true);
  $('#toggleTags').addEventListener('click',()=>{showTags=!showTags;render();});
  $('#toggleAnswers').addEventListener('click',()=>{onlyQuestions=!onlyQuestions;render();});
  $('#expand').textContent='展开当前回答';$('#collapse').textContent='收起当前回答';
  $('#expand').addEventListener('click',()=>{selection().forEach(q=>{openSet.add(q.id);hiddenSet.delete(q.id);});onlyQuestions=false;render();});
  $('#collapse').addEventListener('click',()=>{selection().forEach(q=>{openSet.delete(q.id);hiddenSet.add(q.id);});render();});
  $('#exportjson').addEventListener('click',exportBackup);
  $('#exportmd').addEventListener('click',()=>download(mdExport(),SITE_CONFIG.name+'_复习稿.md','text/markdown;charset=utf-8'));
  $('#import').addEventListener('click',openImport);
  $('#closeModal').addEventListener('click',()=>closeModal('#modalback'));
  $('#importApply').addEventListener('click',doImport);
  for(const id of ['#importarea','#importfile']) $(id).addEventListener('input',()=>{pendingImport=null;$('#importPreview').textContent='';$('#importApply').textContent='预览导入';});
  $('#reset').addEventListener('click',async()=>{
    if(!await askConfirm('仅清空当前浏览器的全部本地草稿，正式题库与收藏练习不变。请先导出 JSON 备份。确认清空？')) return;
    if(await persistDrafts({})) {draftView.clear();render();notice('本地草稿已清空，正在查看正式版。');}
  });
  $('#compareClose').addEventListener('click',()=>closeModal('#compareback'));
  $('#confirmCancel').addEventListener('click',()=>finishConfirm(false));
  $('#confirmApply').addEventListener('click',()=>finishConfirm(true));
  $('#compareExport').addEventListener('click',exportBackup);
  $('#comparePublished').addEventListener('click',()=>{draftView.delete(compareId);closeModal('#compareback');render();notice('正在查看正式版；本地草稿仍保留。');});
  $('#compareKeep').addEventListener('click',async()=>{
    const id=compareId,draft=clone(drafts[id]);
    draft.baseFingerprint=fingerprint(LOOKUP.get(id));
    if(!await persistDrafts({...drafts,[id]:draft})) return;
    draftView.add(id);closeModal('#compareback');render();notice('已保留并显示本地草稿，未同步 GitHub。刷新仍默认查看正式版。');
  });
  document.addEventListener('keydown',event=>{
    const modal=document.querySelector('.modalback:not(.hidden)');
    if(!modal) return;
    if(event.key==='Escape') {if(modal.id==='confirmback')finishConfirm(false);else closeModal('#'+modal.id);}
    if(event.key==='Tab') {
      const controls=[...modal.querySelectorAll('button,input,textarea,select,[href]')].filter(el=>!el.disabled);
      if(event.shiftKey && document.activeElement===controls[0]) {event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey && document.activeElement===controls.at(-1)) {event.preventDefault();controls[0]?.focus();}
    }
  });
  window.addEventListener('storage',event=>{
    if(event.key===DRAFT_KEY) {notice('另一标签页已修改本地草稿。为避免覆盖，请先备份当前编辑，再刷新。',true);const details=$('#syncStatus').closest('details');if(details)details.open=true;}
    if(event.key===PROGRESS_KEY) {try{const next=JSON.parse(event.newValue);if(validProgress(next)) {progress=next;renderOverview();}}catch{}}
  });
  window.addEventListener('beforeunload',event=>{if(editorDirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button,a[data-goto]');if(!button) return;
    if(button.id==='legacyImport') {openImport();try{stageImport({items:legacyItems});}catch(error){$('#importPreview').textContent=error.message;}return;}
    const d=button.dataset;
    if(d.filter){viewFilter=d.filter;$('#search').value='';render();return;}
    if(d.cat){viewFilter='all';selectCat(d.cat);return;}
    if(d.group){viewFilter='all';selectGroup(d.group);return;}
    if(d.goto){event.preventDefault();viewFilter='all';jumpTo(d.goto);return;}
    if(d.expand){const q=get(d.expand);if(q.kind==='deep')openSet.has(q.id)?openSet.delete(q.id):openSet.add(q.id);else hiddenSet.has(q.id)?hiddenSet.delete(q.id):hiddenSet.add(q.id);onlyQuestions=false;render();focusAction('expand',q.id);return;}
    if(d.edit){document.querySelectorAll('.card:not(#'+CSS.escape(d.edit)+') .edittarget').forEach(host=>host.innerHTML='');editor(d.edit);editorOpen=!!document.querySelector('.editor');return;}
    if(d.cancel){document.querySelector('#'+CSS.escape(d.cancel)+' .edittarget').innerHTML='';editorOpen=!!document.querySelector('.editor');editorDirty=false;return;}
    if(d.save){await saveEditor(d.save);return;}
    if(d.compare){compare(d.compare);return;}
    if(d.published){draftView.delete(d.published);render();return;}
    if(d.local){if(draftState(drafts[d.local],LOOKUP.get(d.local))==='conflict')compare(d.local);else{draftView.add(d.local);render();}return;}
    if(d.discard){if(await askConfirm('删除 '+d.discard+' 的本地草稿？正式内容保持不变，请先导出备份。')){const next={...drafts};delete next[d.discard];if(await persistDrafts(next)){draftView.delete(d.discard);render();notice('这题的本地草稿已删除，正在查看正式版。');}}return;}
    if(d.favorite||d.practice){const id=d.favorite||d.practice,kind=d.favorite?'favorites':'practiced';await persistProgress(current=>{if(current[kind][id])delete current[kind][id];else current[kind][id]=d.favorite?true:new Date().toISOString();});render();focusAction(d.favorite?'favorite':'practice',id);return;}
    if(d.copy){try{await navigator.clipboard.writeText(get(d.copy).parts.map(p=>p.text).join('\n\n'));button.textContent='已复制';}catch(error){notice('复制失败，请选中回答文字手动复制。',true);}}
  });
}

// V10 navigation and editor markup are retained below; answer data lives only in JSON.

applyBranding();
boot().catch(error=>{
  if($('#syncSummary'))$('#syncSummary').textContent='正式内容读取失败，请展开查看';
  const details=$('#syncStatus').closest('details');if(details)details.open=true;
  $('#syncStatus').className='sync-panel warning';
  $('#syncStatus').textContent='题库未加载：'+error.message+'。请确认网络后刷新。需通过 HTTP 服务访问，不能直接双击 HTML。';
  $('#currentTitle').textContent='暂时无法读取正式题库';$('#currentDesc').textContent='本地草稿未被用来替代正式内容。';
  $('#content').textContent='请稍后重试；已有本地数据未被清空。';
});

function renderNav(){let s='';for(const c of TAX){const opened=expandedCat===c.id;const active=selectedCat===c.id&&!$('#search').value.trim();const count=c.groups.reduce((n,g)=>n+g.ids.length,0);s+=`<button class="nav-cat ${active?'selected':''}" data-cat="${c.id}" aria-expanded="${opened}" aria-label="${c.title}"><span class="cat-code">${c.id}</span><span style="flex:1">${escapeHTML(c.title)}</span><span class="cat-count">${count}题</span><span class="chevron">${opened?'▾':'▸'}</span></button>`;
 if(opened){s+='<div class="nav-group-wrap">';for(const g of c.groups){const ga=selectedGroup===g.id&&!$('#search').value.trim();const groupOpen=ga&&expandedGroup===g.id;s+=`<button class="nav-group ${ga?'selected':''}" data-group="${g.id}" aria-pressed="${ga}" aria-expanded="${groupOpen}"><span style="flex:1">${escapeHTML(g.title)}</span><span class="group-count">${g.ids.length}题</span><span class="chevron" aria-hidden="true">${groupOpen?'▾':'▸'}</span></button>`;
 if(groupOpen){s+='<div class="nav-questions">';for(const id of g.ids){const q=get(id);s+=`<a class="nav-question" href="#${id}" data-goto="${id}"><strong>${id}</strong>${escapeHTML(q.title)}</a>`}s+='</div>'}}
 s+='</div>'}}
 $('#categoryNav').innerHTML=s;
}
function badges(q){let result=q.skills.slice(0,4).map(k=>`<span class="tag ${q.primarySkill===k?'main-tag':'cross'}">${escapeHTML(SKILLS[k].short)}</span>`).join('');return result}
function relatedLinks(q){const keys=q.kind==='main'?q.deepRefs||[]:(q.related||'').split('/').map(x=>x.trim()).filter(Boolean);const existing=keys.filter(id=>get(id));if(!existing.length)return'';return `<div class="related"><span class="related-label">${q.kind==='main'?'关联简历深挖':'关联主问题'}：</span>${existing.map(id=>`<a href="#${id}" class="linkpill" data-goto="${id}">${id}</a>`).join('')}</div>`}

function scrollTop(){window.scrollTo({top:0,behavior:'smooth'})}
function selectCat(id){if(!CATS[id])return;if(expandedCat===id){expandedCat=null;expandedGroup=null}else{expandedCat=id;selectedCat=id;selectedGroup=null;expandedGroup=null}$('#search').value='';render();scrollTop()}
function selectGroup(id){const g=GROUPS[id];if(!g)return;const same=selectedGroup===id;selectedCat=g.category;selectedGroup=id;expandedGroup=same&&expandedGroup===id?null:id;expandedCat=g.category;$('#search').value='';onlyQuestions=false;render();closeMobileNavigation(true);if(!same)scrollTop()}
function jumpTo(id){const q=get(id);if(!q)return;selectedCat=catOf(q);selectedGroup=q.navGroup;expandedCat=selectedCat;expandedGroup=q.navGroup;$('#search').value='';onlyQuestions=false;if(q.kind==='deep')openSet.add(id);hiddenSet.delete(id);render();closeMobileNavigation();requestAnimationFrame(()=>{const card=document.getElementById(id);card?.scrollIntoView({behavior:'smooth',block:'start'});card?.querySelector('h3')?.focus({preventScroll:true});})}
function editor(id){const q=drafts[id]?{...get(id),...drafts[id].item,navGroup:LOOKUP.get(id).navGroup}:get(id),host=document.querySelector('#'+CSS.escape(id)+' .edittarget');if(!host)return;if(host.innerHTML){host.innerHTML='';return}
 const skillchecks=Object.entries(SKILLS).map(([k,v])=>`<label><input type="checkbox" name="sk-${k}" ${q.skills.includes(k)?'checked':''}>${escapeHTML(v.short)}</label>`).join('');
 const pri=Object.entries(SKILLS).map(([k,v])=>`<option value="${k}" ${q.primarySkill===k?'selected':''}>${escapeHTML(v.name)}</option>`).join('');
 host.innerHTML=`<div class="editor"><b>编辑 ${escapeHTML(id)} · 仅保存为本地草稿 · 未同步 GitHub</b><p class="small-rule">所属目录：${escapeHTML(GROUPS[q.navGroup].title)}（正式目录）；能力标签可以修改。当前表单优先读取这题已有本地草稿。</p><label>问题</label><input name="title" value="${escapeHTML(q.title)}">${q.parts.map((p,i)=>`<label>段落 ${i+1} 标签</label><input name="tag${i}" value="${escapeHTML(p.tag)}"><label>段落内容</label><textarea name="part${i}">${escapeHTML(p.text)}</textarea>`).join('')}<label>答题逻辑</label><textarea name="logic">${escapeHTML(q.logic||'')}</textarea><label>表达提醒／待核实问题</label><textarea name="note">${escapeHTML(q.note||'')}</textarea><label>数据口径</label><textarea name="data">${escapeHTML(q.data||'')}</textarea><label>状态</label><input name="state" value="${escapeHTML(q.state||'可练')}"><label>主能力标签</label><select name="primarySkill">${pri}</select><label>其他关联能力标签</label><div class="checks">${skillchecks}</div><div class="editor-actions"><button class="action primary" data-save="${id}">保存本地草稿</button><button class="action" data-cancel="${id}">取消</button></div></div>`;
 host.querySelectorAll('.editor label').forEach((label,i)=>{const control=label.nextElementSibling;if(control?.matches('input,textarea,select')){control.id='edit-'+id+'-'+i;label.htmlFor=control.id;}});host.scrollIntoView({behavior:'smooth',block:'nearest'})}

function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800)}

"use strict";(self.webpackChunk_wintercms_wn_backend_module=self.webpackChunk_wintercms_wn_backend_module||[]).push([[147],{613:function(e,t,n){var i=n(341);class a extends Snowboard.Singleton{listens(){return{ready:"ready",ajaxFetchOptions:"ajaxFetchOptions",ajaxUpdateComplete:"ajaxUpdateComplete"}}ready(){window.jQuery&&((0,i.c)("render"),document.addEventListener("$render",(()=>{this.snowboard.globalEvent("render")})),window.jQuery(document).trigger("render"))}addPrefilter(){window.jQuery&&window.jQuery.ajaxPrefilter((e=>{this.hasToken()&&(e.headers||(e.headers={}),e.headers["X-CSRF-TOKEN"]=this.getToken())}))}ajaxFetchOptions(e){this.hasToken()&&(e.headers["X-CSRF-TOKEN"]=this.getToken())}ajaxUpdateComplete(){window.jQuery&&window.jQuery(document).trigger("render")}hasToken(){const e=document.querySelector('meta[name="csrf-token"]');return!!e&&!!e.hasAttribute("content")}getToken(){return document.querySelector('meta[name="csrf-token"]').getAttribute("content")}}class r extends Snowboard.PluginBase{construct(e,t){if(e instanceof Snowboard.PluginBase==!1)throw new Error("Event handling can only be applied to Snowboard classes.");if(!t)throw new Error("Event prefix is required.");this.instance=e,this.eventPrefix=t,this.events=[]}on(e,t){this.events.push({event:e,callback:t})}off(e,t){this.events=this.events.filter((n=>n.event!==e||n.callback!==t))}once(e,t){var n=this;const i=this.events.push({event:e,callback:function(){t(...arguments),n.events.splice(i-1,1)}})}fire(e){for(var t=arguments.length,n=new Array(t>1?t-1:0),i=1;i<t;i++)n[i-1]=arguments[i];const a=this.events.filter((t=>t.event===e));let r=!1;a.forEach((e=>{r||!1===e.callback(...n)&&(r=!0)})),r||this.snowboard.globalEvent(`${this.eventPrefix}.${e}`,...n)}firePromise(e){for(var t=arguments.length,n=new Array(t>1?t-1:0),i=1;i<t;i++)n[i-1]=arguments[i];const a=this.events.filter((t=>t.event===e)),r=a.filter((e=>null!==e),a.map((e=>e.callback(...n))));Promise.all(r).then((()=>{this.snowboard.globalPromiseEvent(`${this.eventPrefix}.${e}`,...n)}))}}class s extends Snowboard.Singleton{construct(){this.registeredWidgets=[],this.elements=[],this.events={mutate:(e,t)=>this.onMutation(e,t)}}listens(){return{ready:"onReady",render:"onReady",ajaxUpdate:"onAjaxUpdate"}}register(e,t,n){this.registeredWidgets.push({control:e,widget:t,callback:n})}unregister(e){this.registeredWidgets=this.registeredWidgets.filter((t=>t.control!==e))}onReady(){this.initializeWidgets(document.body)}onAjaxUpdate(e){this.initializeWidgets(e)}initializeWidgets(e){this.registeredWidgets.forEach((t=>{const n=e.querySelectorAll(`[data-control="${t.control}"]:not([data-widget-initialized])`);n.length&&n.forEach((e=>{if(e.dataset.widgetInitialized)return;const n=new MutationObserver(this.events.mutate);n.observe(e.parentElement,{childList:!0});const i=this.snowboard[t.widget](e);this.elements.push({element:e,instance:i,observer:n}),e.dataset.widgetInitialized=!0,this.snowboard.globalEvent("backend.widget.initialized",e,i),"function"==typeof t.callback&&t.callback(i,e)}))}))}getWidget(e){const t=this.elements.find((t=>t.element===e));return t?t.instance:null}onMutation(e,t){console.log(e),console.log(t)}}if(void 0===window.Snowboard)throw new Error("Snowboard must be loaded in order to use the Backend UI.");(e=>{e.addPlugin("backend.ajax.handler",a),e.addPlugin("backend.ui.eventHandler",r),e.addPlugin("backend.ui.widgetHandler",s),e["backend.ajax.handler"]().addPrefilter(),window.AssetManager={load:(t,n)=>{e.assetLoader().load(t).then((()=>{n&&"function"==typeof n&&n()}))}},window.assetManager=window.AssetManager})(window.Snowboard)}},function(e){e.O(0,[101],(function(){return t=613,e(e.s=t);var t}));e.O()}]);
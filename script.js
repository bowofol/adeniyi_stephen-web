document.documentElement.classList.add("js");
const toggle=document.querySelector(".nav-toggle");
const nav=document.querySelector(".site-nav");
const header=document.querySelector("[data-header]");
const year=document.querySelector("[data-year]");
if(year)year.textContent=new Date().getFullYear();
function closeNav(){if(!toggle||!nav)return;toggle.setAttribute("aria-expanded","false");nav.classList.remove("is-open");}
if(toggle&&nav){
  toggle.addEventListener("click",()=>{const open=toggle.getAttribute("aria-expanded")==="true";toggle.setAttribute("aria-expanded",String(!open));nav.classList.toggle("is-open",!open);});
  nav.addEventListener("click",event=>{if(event.target.closest("a"))closeNav();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeNav();});
  document.addEventListener("click",event=>{if(!nav.contains(event.target)&&!toggle.contains(event.target))closeNav();});
}
function updateHeader(){if(header)header.classList.toggle("has-shadow",window.scrollY>8);}
window.addEventListener("scroll",updateHeader,{passive:true});updateHeader();
const items=document.querySelectorAll(".reveal");
const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(reduce||!("IntersectionObserver"in window)){items.forEach(item=>item.classList.add("is-visible"));}
else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.12});items.forEach(item=>observer.observe(item));}

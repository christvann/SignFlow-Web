<template>
  <div>
    <nav class="shadow p-4 bg-gradient-to-br from-blue-300/70 to-orange-500/20 flex justify-between items-center">
      <a href="/" class="hover:scale-105 transition-all cursor-pointer flex items-center gap-2">
        <img src="/logo.svg" alt="SignFlow Logo" class="h-8 w-auto" />
        <span class="text-xl font-sans text-[#000000] font-bold hidden sm:inline">SignFlow</span>
      </a>
      <div class="space-x-4 hidden md:flex gap-5">
        <router-link to="/" class="hover:text-[#2563EB] hover:scale-105 transition-all cursor-pointer font-sans text-[#000000] font-semibold">Home</router-link>
        <router-link to="/capture" class="hover:text-[#2563EB] hover:scale-105 transition-all cursor-pointer font-sans text-[#000000] font-semibold">Capture</router-link>
        <router-link to="/detect" class="hover:text-[#2563EB] hover:scale-105 transition-all cursor-pointer font-sans text-[#000000] font-semibold">Detect</router-link>
        <router-link to="/about" class="hover:text-[#2563EB] hover:scale-105 transition-all cursor-pointer font-sans text-[#000000] font-semibold">About</router-link>
      </div>
    </nav>
    <router-view />
  </div>
</template>
<style>
.router-link-active {
  position: relative;
  color: #2563EB;

}
.router-link-active::after {
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -4px;
  width: 100%;
  height: 3px;
  background-color: #2563EB;
  border-radius: 2px;
  opacity: 1;
  transform-origin: center;
  transition: all 0.3s ease;
}
</style>
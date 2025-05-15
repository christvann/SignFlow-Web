import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Detect from '../views/Detect.vue'
import About from '../views/About.vue'
import Capture from '../views/Capture.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/capture', component: Capture },
  { path: '/detect', component: Detect },
  { path: '/about', component: About },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

/* ============================= */
/* ILLUMINATOR ENGINE */
/* ============================= */

const Engine = {}

/* ============================= */
/* DATA STRUCTURES */
/* ============================= */

Engine.state = {

projects:[],

tasks:[],

history:[],

energyProfile:{},

settings:{

workStart:9,
workEnd:18,

morningWriteStart:8,
morningWriteEnd:8.5,

eveningStart:20,
eveningEnd:23,

weekendHours:4

}

}


/* ============================= */
/* PROJECT CREATION */
/* ============================= */

Engine.createProject = function({

name,
deadline,
fragments,
fragmentDuration,
priority,
weeklyTarget,
energyRequired

}){

const projectId = crypto.randomUUID()

const project = {

id:projectId,
name,
deadline,
fragments,
fragmentDuration,
priority,
weeklyTarget,
energyRequired,
progress:0

}

Engine.state.projects.push(project)

Engine.generateFragments(project)

return project

}


/* ============================= */
/* FRAGMENT GENERATION */
/* ============================= */

Engine.generateFragments = function(project){

for(let i=0;i<project.fragments;i++){

Engine.state.tasks.push({

id:crypto.randomUUID(),

projectId:project.id,

title:project.name+" fragment "+(i+1),

duration:project.fragmentDuration,

energy:project.energyRequired,

status:"pending",

scheduled:null

})

}

}


/* ============================= */
/* ENERGY PROFILE */
/* ============================= */

Engine.recordEnergy = function(hour,value){

Engine.state.energyProfile[hour] = value

}


/* ============================= */
/* ENERGY ESTIMATION */
/* ============================= */

Engine.estimateEnergy = function(hour){

if(Engine.state.energyProfile[hour]!==undefined){

return Engine.state.energyProfile[hour]

}

const peak = document.getElementById("energyPeak")?.value || 21

const distance = Math.abs(hour - peak)

return Math.max(0,10-distance)

}


/* ============================= */
/* TASK SCORING */
/* ============================= */

Engine.scoreTask = function(task,currentHour){

let urgencyScore = 1

const project = Engine.state.projects.find(
p=>p.id===task.projectId
)

if(project){

const daysLeft =
(
new Date(project.deadline) - new Date()
) / (1000*60*60*24)

urgencyScore = Math.max(1,10-daysLeft)

}

const energyMatch =
Engine.estimateEnergy(currentHour) /
task.energy

const durationFit =
task.duration < 60 ? 1.2 : 1

return urgencyScore * energyMatch * durationFit

}


/* ============================= */
/* TASK SUGGESTION */
/* ============================= */

Engine.suggestTask = function(){

const hour = new Date().getHours()

const availableTasks =
Engine.state.tasks.filter(t=>t.status==="pending")

if(availableTasks.length===0) return null

let bestTask = null
let bestScore = -Infinity

availableTasks.forEach(task=>{

const score =
Engine.scoreTask(task,hour)

if(score>bestScore){

bestScore = score
bestTask = task

}

})

return bestTask

}


/* ============================= */
/* RANDOM TASK */
/* ============================= */

Engine.randomTask = function(){

const tasks =
Engine.state.tasks.filter(t=>t.status==="pending")

if(tasks.length===0) return null

const index =
Math.floor(Math.random()*tasks.length)

return tasks[index]

}


/* ============================= */
/* COMPLETE TASK */
/* ============================= */

Engine.completeTask = function(taskId,realDuration){

const task =
Engine.state.tasks.find(t=>t.id===taskId)

if(!task) return

task.status="done"

Engine.state.history.push({

taskId:taskId,

date:new Date(),

duration:realDuration

})

Engine.updateProjectProgress(task.projectId)

}


/* ============================= */
/* PROJECT PROGRESS */
/* ============================= */

Engine.updateProjectProgress = function(projectId){

const project =
Engine.state.projects.find(p=>p.id===projectId)

const tasks =
Engine.state.tasks.filter(t=>t.projectId===projectId)

const done =
tasks.filter(t=>t.status==="done").length

project.progress =
Math.round((done/tasks.length)*100)

}


/* ============================= */
/* LEARNING RHYTHMS */
/* ============================= */

Engine.learnEnergyPatterns = function(){

const hourly = {}

Engine.state.history.forEach(entry=>{

const hour = new Date(entry.date).getHours()

if(!hourly[hour]){

hourly[hour]=0

}

hourly[hour]+=entry.duration

})

Object.keys(hourly).forEach(hour=>{

Engine.state.energyProfile[hour] =
hourly[hour]

})

}


/* ============================= */
/* STATS */
/* ============================= */

Engine.getStats = function(){

let totalEstimated = 0
let totalReal = 0

Engine.state.tasks.forEach(t=>{

totalEstimated += t.duration

})

Engine.state.history.forEach(h=>{

totalReal += h.duration

})

return{

estimated:totalEstimated,
real:totalReal

}

}


/* ============================= */
/* STORAGE */
/* ============================= */

Engine.save = function(){

localStorage.setItem(
"illuminator-data",
JSON.stringify(Engine.state)
)

}

Engine.load = function(){

const data =
localStorage.getItem("illuminator-data")

if(data){

Engine.state = JSON.parse(data)

}

}

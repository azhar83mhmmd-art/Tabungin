/* =========================================================
   charts.js — wrapper Chart.js untuk statistik
   ========================================================= */
const chartInstances = {};

function destroyChart(id){
  if(chartInstances[id]){ chartInstances[id].destroy(); delete chartInstances[id]; }
}

function chartTheme(){
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text: dark ? '#9FB3A9' : '#5A6F66',
    teal: '#1FBE8C',
    gold: '#E8B84B',
    red: '#F0596B'
  };
}

function renderLineChart(canvasId, labels, data, label){
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  const t = chartTheme();
  const grad = ctx.getContext('2d').createLinearGradient(0,0,0,220);
  grad.addColorStop(0,'rgba(31,190,140,0.35)');
  grad.addColorStop(1,'rgba(31,190,140,0)');
  chartInstances[canvasId] = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label, data, borderColor:t.teal, backgroundColor:grad, fill:true, tension:.4, pointRadius:3, pointBackgroundColor:t.teal }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:'transparent'}, ticks:{color:t.text, font:{size:11}} },
        y:{ grid:{color:t.grid}, ticks:{color:t.text, font:{size:11}} }
      }
    }
  });
}

function renderBarChart(canvasId, labels, dataSets){
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  const t = chartTheme();
  chartInstances[canvasId] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets: dataSets.map(ds=>({ ...ds, borderRadius:8, barThickness:18 })) },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:t.text, font:{size:11} } } },
      scales:{
        x:{ grid:{color:'transparent'}, ticks:{color:t.text, font:{size:11}} },
        y:{ grid:{color:t.grid}, ticks:{color:t.text, font:{size:11}} }
      }
    }
  });
}

function renderDoughnutChart(canvasId, labels, data){
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  const t = chartTheme();
  const palette = ['#1FBE8C','#E8B84B','#5AA8E8','#F0596B','#9B7BE8','#E87BBE','#7BE8C9','#E8C97B','#7B9BE8','#E89B7B','#A0E87B'];
  chartInstances[canvasId] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:palette, borderWidth:0, hoverOffset:6 }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{ legend:{ position:'bottom', labels:{ color:t.text, font:{size:11}, boxWidth:10, padding:12 } } }
    }
  });
}

window.chartsApi = { renderLineChart, renderBarChart, renderDoughnutChart, destroyChart };

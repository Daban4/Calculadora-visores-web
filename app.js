/* --- APP.JS: EL CEREBRO DE LA CALCULADORA DE VISORES --- */

// --- 1. ESTADO DE LA APLICACIÓN (MEMORIA LOCAL) ---
const DEFAULTS = {
    profiles: {
        "Principal": {
            id: "p1",
            method: "Interpolación",
            data: [
                { dist: 20, alt: 1.0 },
                { dist: 40, alt: 3.5 },
                { dist: 70, alt: 8.0 }
            ],
            settings: { start: 10, end: 70, step: 5 }
        }
    },
    currentProfileId: "p1"
};

let state = JSON.parse(localStorage.getItem('visor_state')) || DEFAULTS;

function saveState() {
    localStorage.setItem('visor_state', JSON.stringify(state));
}

// --- 2. MOTOR MATEMÁTICO (TRADUCCIÓN DE NUMPY) ---

/**
 * Regresión Cuadrática (Equivalente a np.polyfit(x, y, 2))
 * Resuelve el sistema de ecuaciones para y = ax^2 + bx + c
 */
function polyfit2(x, y) {
    let n = x.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;

    for (let i = 0; i < n; i++) {
        let xi = x[i];
        let yi = y[i];
        let xi2 = xi * xi;
        sumX += xi;
        sumX2 += xi2;
        sumX3 += xi2 * xi;
        sumX4 += xi2 * xi2;
        sumY += yi;
        sumXY += xi * yi;
        sumX2Y += xi2 * yi;
    }

    // Sistema de ecuaciones 3x3 (Regla de Cramer)
    let det = (n * (sumX2 * sumX4 - sumX3 * sumX3)) - 
              (sumX * (sumX * sumX4 - sumX2 * sumX3)) + 
              (sumX2 * (sumX * sumX3 - sumX2 * sumX2));

    if (Math.abs(det) < 1e-10) return [0, 0, 0];

    // Calculamos a, b, c
    let c = ((sumY * (sumX2 * sumX4 - sumX3 * sumX3)) - 
             (sumX * (sumXY * sumX4 - sumX2Y * sumX3)) + 
             (sumX2 * (sumXY * sumX3 - sumX2Y * sumX2))) / det;

    let b = ((n * (sumXY * sumX4 - sumX2Y * sumX3)) - 
             (sumY * (sumX * sumX4 - sumX2 * sumX3)) + 
             (sumX2 * (sumX * sumX2Y - sumXY * sumX2))) / det;

    let a = ((n * (sumX2 * sumX2Y - sumXY * sumX3)) - 
             (sumX * (sumX * sumX2Y - sumX2 * sumXY)) + 
             (sumY * (sumX * sumX3 - sumX2 * sumX2))) / det;

    return [a, b, c]; // Coeficientes: ax^2 + bx + c
}

/**
 * Interpolación Lineal con Extrapolación (Equivalente a np.interp)
 */
function interpolate(xQuery, xKeys, yKeys) {
    // Si el valor está fuera por la izquierda
    if (xQuery < xKeys[0]) {
        let slope = (yKeys[1] - yKeys[0]) / (xKeys[1] - xKeys[0]);
        return yKeys[0] + (xQuery - xKeys[0]) * slope;
    }
    // Si el valor está fuera por la derecha
    if (xQuery > xKeys[xKeys.length - 1]) {
        let last = xKeys.length - 1;
        let slope = (yKeys[last] - yKeys[last - 1]) / (xKeys[last] - xKeys[last - 1]);
        return yKeys[last] + (xQuery - xKeys[last]) * slope;
    }
    // Búsqueda del tramo
    for (let i = 0; i < xKeys.length - 1; i++) {
        if (xQuery >= xKeys[i] && xQuery <= xKeys[i + 1]) {
            let slope = (yKeys[i + 1] - yKeys[i]) / (xKeys[i + 1] - xKeys[i]);
            return yKeys[i] + (xQuery - xKeys[i]) * slope;
        }
    }
    return 0;
}

// --- 3. LÓGICA DE LA INTERFAZ (UI) ---

const elements = {
    profileSelect: document.getElementById('profileSelect'),
    btnNewProfile: document.getElementById('btnNewProfile'),
    btnDeleteProfile: document.getElementById('btnDeleteProfile'),
    dataRowsContainer: document.getElementById('dataRowsContainer'),
    btnAddRow: document.getElementById('btnAddRow'),
    btnSortData: document.getElementById('btnSortData'),
    inputStart: document.getElementById('inputStart'),
    inputEnd: document.getElementById('inputEnd'),
    inputStep: document.getElementById('inputStep'),
    resultTable: document.getElementById('resultTable').getElementsByTagName('tbody')[0],
    btnDownload: document.getElementById('btnDownload')
};

function renderProfiles() {
    elements.profileSelect.innerHTML = "";
    Object.keys(state.profiles).forEach(pName => {
        let opt = document.createElement('option');
        opt.value = pName;
        opt.textContent = pName;
        if (pName === state.currentProfileId) opt.selected = true;
        elements.profileSelect.appendChild(opt);
    });
}

function renderDataRows() {
    const profile = state.profiles[state.currentProfileId];
    elements.dataRowsContainer.innerHTML = "";
    
    profile.data.forEach((row, index) => {
        const div = document.createElement('div');
        div.className = 'data-row';
        div.innerHTML = `
            <input type="number" value="${row.dist}" onchange="updateData(${index}, 'dist', this.value)">
            <input type="number" value="${row.alt}" step="0.1" onchange="updateData(${index}, 'alt', this.value)">
            <button class="btn-del" onclick="deleteRow(${index})">🗑️</button>
        `;
        elements.dataRowsContainer.appendChild(div);
    });
    calculateAndRender();
}

window.updateData = (index, key, value) => {
    state.profiles[state.currentProfileId].data[index][key] = parseFloat(value);
    saveState();
    calculateAndRender();
};

window.deleteRow = (index) => {
    state.profiles[state.currentProfileId].data.splice(index, 1);
    saveState();
    renderDataRows();
};

elements.btnAddRow.onclick = () => {
    state.profiles[state.currentProfileId].data.push({ dist: 0, alt: 0 });
    saveState();
    renderDataRows();
};

elements.btnSortData.onclick = () => {
    state.profiles[state.currentProfileId].data.sort((a, b) => a.dist - b.dist);
    saveState();
    renderDataRows();
};

// --- AJUSTES DE CÁLCULO ---
[elements.inputStart, elements.inputEnd, elements.inputStep].forEach(el => {
    el.onchange = () => {
        const profile = state.profiles[state.currentProfileId];
        profile.settings.start = parseInt(elements.inputStart.value);
        profile.settings.end = parseInt(elements.inputEnd.value);
        profile.settings.step = parseInt(elements.inputStep.value);
        saveState();
        calculateAndRender();
    };
});

document.querySelectorAll('input[name="calcMethod"]').forEach(el => {
    el.onchange = (e) => {
        state.profiles[state.currentProfileId].method = e.target.value;
        saveState();
        calculateAndRender();
    };
});

// --- CÁLCULO FINAL ---
function calculateAndRender() {
    const profile = state.profiles[state.currentProfileId];
    const data = profile.data.filter(d => d.dist > 0);
    
    if (data.length < 2) {
        elements.resultTable.innerHTML = "<tr><td colspan='2'>⚠️ Introduce al menos 2 puntos</td></tr>";
        return;
    }

    const dists = data.map(d => d.dist);
    const alts = data.map(d => d.alt);
    const method = profile.method;
    const { start, end, step } = profile.settings;

    elements.resultTable.innerHTML = "";
    
    let coeffs = (method === 'Regresión') ? polyfit2(dists, alts) : null;

    for (let d = start; d <= end; d += step) {
        let res = 0;
        if (method === 'Regresión') {
            res = coeffs[0] * d * d + coeffs[1] * d + coeffs[2];
        } else {
            res = interpolate(d, dists, alts);
        }

        const row = elements.resultTable.insertRow();
        row.insertCell(0).textContent = d;
        row.insertCell(1).textContent = res.toFixed(2);
    }
}

// --- GESTIÓN DE PERFILES ---
elements.btnNewProfile.onclick = () => {
    const name = prompt("Nombre del nuevo Perfil:");
    if (name && !state.profiles[name]) {
        state.profiles[name] = {
            id: name,
            method: "Interpolación",
            data: [
                { dist: 20, alt: 1.0 },
                { dist: 40, alt: 3.5 },
                { dist: 70, alt: 8.0 }
            ],
            settings: { start: 10, end: 70, step: 5 }
        };
        state.currentProfileId = name;
        saveState();
        renderProfiles();
        renderDataRows();
    }
};

elements.btnDeleteProfile.onclick = () => {
    const names = Object.keys(state.profiles);
    if (names.length > 1) {
        if (confirm(`¿Borrar el perfil "${state.currentProfileId}"?`)) {
            delete state.profiles[state.currentProfileId];
            state.currentProfileId = Object.keys(state.profiles)[0];
            saveState();
            renderProfiles();
            renderDataRows();
        }
    } else {
        alert("No puedes borrar el último perfil.");
    }
};

elements.profileSelect.onchange = (e) => {
    state.currentProfileId = e.target.value;
    const p = state.profiles[state.currentProfileId];
    
    // Sincronizar ajustes al cambiar de perfil
    elements.inputStart.value = p.settings.start;
    elements.inputEnd.value = p.settings.end;
    elements.inputStep.value = p.settings.step;
    document.querySelector(`input[name="calcMethod"][value="${p.method}"]`).checked = true;
    
    saveState();
    renderDataRows();
};

// --- GENERADOR DE PNG (USANDO CANVAS) ---
elements.btnDownload.onclick = () => {
    const profile = state.profiles[state.currentProfileId];
    const data = [];
    const rows = elements.resultTable.rows;
    for (let i = 0; i < rows.length; i++) {
        data.push([rows[i].cells[0].textContent, rows[i].cells[1].textContent]);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 600;
    const CH = 50;
    const HH = 120;
    const IMG_H = HH + (data.length + 1) * CH + 40;

    canvas.width = W;
    canvas.height = IMG_H;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, IMG_H);

    // Cabecera
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`PERFIL: ${state.currentProfileId.toUpperCase()}`, 40, 50);
    ctx.font = '20px sans-serif';
    ctx.fillText(`MODO: ${profile.method} | ${new Date().toLocaleDateString()}`, 40, 90);

    // Tabla
    let currY = HH;
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(40, currY, W - 80, CH);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText("DISTANCIA (m)", 60, currY + 35);
    ctx.fillText("ALTURA (cm)", W/2 + 20, currY + 35);
    currY += CH;

    ctx.font = '22px sans-serif';
    data.forEach(row => {
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(40, currY);
        ctx.lineTo(W - 40, currY);
        ctx.stroke();

        ctx.fillText(`${row[0]} m`, 60, currY + 35);
        ctx.fillText(row[1], W/2 + 20, currY + 35);
        currY += CH;
    });

    // Bordes
    ctx.lineWidth = 2;
    ctx.strokeRect(40, HH, W - 80, currY - HH);
    ctx.beginPath();
    ctx.moveTo(W/2, HH);
    ctx.lineTo(W/2, currY);
    ctx.stroke();

    // Descarga
    const link = document.createElement('a');
    link.download = `Calculo_${state.currentProfileId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

// --- INICIO ---
renderProfiles();
renderDataRows();
const currentP = state.profiles[state.currentProfileId];
elements.inputStart.value = currentP.settings.start;
elements.inputEnd.value = currentP.settings.end;
elements.inputStep.value = currentP.settings.step;
document.querySelector(`input[name="calcMethod"][value="${currentP.method}"]`).checked = true;

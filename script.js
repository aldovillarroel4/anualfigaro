// Al inicio del archivo, antes de la declaración de variables
const STORAGE_KEY = 'figaroData';

// Estructura de datos para almacenar la información por año y mes
let allYearsData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let financialData = {};
let currentMonth = '';
let selectedYear = new Date().getFullYear();

// Inicializar la aplicación
function init() {
    // Asegurarse de que existan datos para el año seleccionado
    if (!allYearsData[selectedYear]) {
        allYearsData[selectedYear] = {};
    }
    financialData = allYearsData[selectedYear];

    // Limpiar las pestañas existentes
    const tabsContainer = document.getElementById('monthTabs');
    tabsContainer.innerHTML = '';

    // Crear pestañas para los últimos 12 meses
    const months = getLastTwelveMonths();
    months.forEach((month) => {
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.textContent = month;
        tab.onclick = () => selectMonth(month);
        tabsContainer.appendChild(tab);

        // Inicializar datos del mes si no existen
        if (!financialData[month]) {
            financialData[month] = { income: [], expenses: [] };
        }
    });

    // Seleccionar el mes actual o el primer mes si no hay mes actual
    selectMonth(currentMonth || months[0]);
}

function getLastTwelveMonths() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return monthNames;
}

function selectMonth(month) {
    currentMonth = month;
    // Actualizar pestañas activas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === month);
    });

    // Cargar datos del mes
    loadMonthData();
}

function loadMonthData() {
    const data = financialData[currentMonth];

    // Cargar ingresos
    const incomeBody = document.getElementById('incomeBody');
    incomeBody.innerHTML = '';
    data.income.forEach((item, index) => {
        const row = createIncomeRow(item, index);
        incomeBody.appendChild(row);
    });

    // Cargar egresos
    const expensesBody = document.getElementById('expensesBody');
    expensesBody.innerHTML = '';
    data.expenses.forEach((item, index) => {
        const row = createExpenseRow(item, index);
        expensesBody.appendChild(row);
    });

    updateTotals();
}

// Función auxiliar para formatear números como pesos chilenos
function formatCLP(number) {
    if (!number || isNaN(number)) return '$0';
    try {
        // Intentar usar Intl.NumberFormat primero
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    } catch (error) {
        // Fallback manual para Safari si Intl falla
        console.warn('Intl.NumberFormat failed, using manual formatting:', error);
        return formatCLPDisplay(number);
    }
}

// Función manual para formatear CLP si Intl.NumberFormat falla
function formatCLPDisplay(number) {
    if (!number || isNaN(number)) return '$0';
    const num = Math.round(parseFloat(number));
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `$${formatted}`;
}

// Función mejorada para formatear números en inputs (robusta para Safari)
function formatCLPInputRobust(number) {
    if (!number || isNaN(number)) return '';
    const num = typeof number === 'string' ? parseFloat(number) : number;
    if (isNaN(num)) return '';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Función para parsear valores desde inputs con formato chileno
function parseFromCurrencyInput(inputValue) {
    if (!inputValue) return 0;
    let cleaned = inputValue.toString();

    // Remover todo excepto números, puntos y comas
    cleaned = cleaned.replace(/[^\d.,]/g, '');
    if (!cleaned) return 0;

    if (cleaned.includes(',')) {
        // Reemplazar puntos (miles) y coma por punto decimal
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
        // Solo puntos - verificar decimal o miles
        const parts = cleaned.split('.');
        if (parts.length === 2 && parts[1].length <= 2 && parts[0].length <= 3) {
            // Decimal probable - mantener
        } else {
            // Separadores de miles
            cleaned = cleaned.replace(/\./g, '');
        }
    }

    const result = parseFloat(cleaned) || 0;
    return result;
}

// Función mejorada para formatear input mientras se escribe
function formatCurrencyInputRobust(input) {
    if (!input.value) return;

    const cursorPosition = input.selectionStart;
    const originalValue = input.value;

    const numericValue = parseFromCurrencyInput(input.value);

    if (numericValue >= 0) {
        const formattedValue = formatCLPInputRobust(numericValue);

        if (formattedValue !== originalValue) {
            input.value = formattedValue;

            // Ajustar posición del cursor
            const addedChars = formattedValue.length - originalValue.length;
            let newPosition = cursorPosition + addedChars;

            newPosition = Math.max(0, Math.min(formattedValue.length, newPosition));
            setTimeout(() => {
                if (input === document.activeElement) {
                    input.setSelectionRange(newPosition, newPosition);
                }
            }, 0);
        }
    }
}

// Maneja cambios en inputs de moneda con formato robusto
function handleCurrencyInputRobust(input, index, type) {
    const value = parseFromCurrencyInput(input.value);

    if (type === 'income') {
        updateIncome(index, 'amount', value);
    } else if (type === 'expense') {
        updateExpense(index, 'amount', value);
    }
}

// Funciones para crear filas con inputs que usan formateo robusto
function createIncomeRow(item = {}, index) {
    const tr = document.createElement('tr');
    const formattedAmount = item.amount ? formatCLPInputRobust(item.amount) : '';
    tr.innerHTML = `
        <td><input type="text" value="${item.description || ''}" onchange="updateIncome(${index}, 'description', this.value)"></td>
        <td>
            <div style="display: flex; align-items: center; justify-content: space-between">
                <input type="text" value="${formattedAmount}"
                    onchange="handleCurrencyInputRobust(this, ${index}, 'income')"
                    oninput="formatCurrencyInputRobust(this)"
                    onblur="formatCurrencyInputRobust(this)"
                    placeholder="0">
                <button class="delete-btn" onclick="deleteIncome(${index})">×</button>
            </div>
        </td>
    `;
    return tr;
}

function createExpenseRow(item = {}, index) {
    const tr = document.createElement('tr');
    const secondFloorValue = calculateSecondFloor(item.amount || 0, item.percentage || 0);
    const formattedAmount = item.amount ? formatCLPInputRobust(item.amount) : '';
    tr.innerHTML = `
        <td><input type="text" value="${item.description || ''}" onchange="updateExpense(${index}, 'description', this.value)"></td>
        <td>
            <div style="display: flex; align-items: center; justify-content: space-between">
                <input type="text" value="${formattedAmount}"
                    onchange="handleCurrencyInputRobust(this, ${index}, 'expense')"
                    oninput="formatCurrencyInputRobust(this)"
                    onblur="formatCurrencyInputRobust(this)"
                    placeholder="0">
                <button class="delete-btn" onclick="deleteExpense(${index})">×</button>
            </div>
        </td>
        <td>
            <div class="second-floor-cell">
                <input type="number" class="percentage-input" value="${item.percentage || 0}"
                    onchange="updateExpensePercentage(${index}, parseFloat(this.value))"
                    min="0" max="100" step="0.1">
                <span>% = ${formatCLP(secondFloorValue)}</span>
            </div>
        </td>
    `;
    return tr;
}

// Funciones para actualizar ingresos, egresos y totales
function updateIncome(index, field, value) {
    financialData[currentMonth].income[index][field] = field === 'amount' ? Number(value) : value;
    updateTotals();
    saveData();
}

function updateExpense(index, field, value) {
    financialData[currentMonth].expenses[index][field] = field === 'amount' ? Number(value) : value;
    updateTotals();
    saveData();
}

function updateExpensePercentage(index, value) {
    financialData[currentMonth].expenses[index].percentage = value;
    updateTotals();
    saveData();
}

// Función para actualizar totales (debe estar ya implementada en tu código)
function updateTotals() {
    // Lógica para sumar ingresos y egresos y actualizar el DOM
}

// Función para guardar los datos en localStorage
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allYearsData));
}

// Función para calcular el segundo piso (debe estar ya implementada en tu código)
function calculateSecondFloor(amount, percentage) {
    return (amount * percentage) / 100;
}

// Inicialización al cargar la página
window.onload = init;

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase configuration and app ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;
let unsubscribeSnapshot = null; // To store the onSnapshot unsubscribe function

const taskInput = document.getElementById('taskInput');
const addTaskButton = document.getElementById('addTaskButton');
const breakdownTaskButton = document.getElementById('breakdownTaskButton');
const breakdownButtonText = document.getElementById('breakdownButtonText');
const breakdownSpinner = document.getElementById('breakdownSpinner');
const taskList = document.getElementById('taskList');
const userIdDisplay = document.getElementById('userIdDisplay');

const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');

const editTaskModal = document.getElementById('editTaskModal');
const closeEditModal = document.getElementById('closeEditModal');
const editTaskInput = document.getElementById('editTaskInput');
const cancelEditButton = document.getElementById('cancelEditButton');
const saveEditButton = document.getElementById('saveEditButton');

const breakdownModal = document.getElementById('breakdownModal');
const closeBreakdownModal = document.getElementById('closeBreakdownModal');
const subTaskList = document.getElementById('subTaskList');
const cancelBreakdownButton = document.getElementById('cancelBreakdownButton');
const addSelectedSubtasksButton = document.getElementById('addSelectedSubtasksButton');

let taskToDeleteId = null;
let taskToEditId = null;

// Function to show a modal
function showModal(modalElement) {
    modalElement.style.display = 'flex';
}

// Function to hide a modal
function hideModal(modalElement) {
    modalElement.style.display = 'none';
}

// Event listener for delete modal close button
closeDeleteModal.onclick = () => hideModal(deleteConfirmModal);
cancelDeleteButton.onclick = () => hideModal(deleteConfirmModal);

// Event listener for edit modal close button
closeEditModal.onclick = () => hideModal(editTaskModal);
cancelEditButton.onclick = () => hideModal(editTaskModal);

// Event listener for breakdown modal close button
closeBreakdownModal.onclick = () => hideModal(breakdownModal);
cancelBreakdownButton.onclick = () => hideModal(breakdownModal);

// Close modal if clicking outside the modal content
window.onclick = (event) => {
    if (event.target == deleteConfirmModal) {
        hideModal(deleteConfirmModal);
    }
    if (event.target == editTaskModal) {
        hideModal(editTaskModal);
    }
    if (event.target == breakdownModal) {
        hideModal(breakdownModal);
    }
};

// Function to add a new task
async function addTask(text) {
    const taskText = text.trim();
    if (taskText === "" || !userId) {
        console.log("Task text is empty or user not authenticated.");
        return;
    }
    try {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/tasks`), {
            text: taskText,
            completed: false,
            createdAt: new Date()
        });
        // Only clear input if adding from the main input, not from breakdown modal
        if (text === taskInput.value) {
            taskInput.value = '';
        }
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

// Function to toggle task completion status
async function toggleTaskCompletion(taskId, currentStatus) {
    if (!userId) return;
    try {
        const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
        await updateDoc(taskRef, {
            completed: !currentStatus
        });
    } catch (e) {
        console.error("Error updating document: ", e);
    }
}

// Function to delete a task
async function deleteTask() {
    if (!taskToDeleteId || !userId) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskToDeleteId));
        hideModal(deleteConfirmModal);
        taskToDeleteId = null;
    } catch (e) {
        console.error("Error deleting document: ", e);
    }
}

// Function to update a task
async function updateTask() {
    const updatedText = editTaskInput.value.trim();
    if (!taskToEditId || updatedText === "" || !userId) {
        console.log("Task text is empty or user not authenticated.");
        return;
    }
    try {
        const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskToEditId);
        await updateDoc(taskRef, {
            text: updatedText
        });
        hideModal(editTaskModal);
        taskToEditId = null;
    } catch (e) {
        console.error("Error updating document: ", e);
    }
}

// Function to display tasks
function displayTasks(tasks) {
    taskList.innerHTML = ''; // Clear the list before displaying
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.id = `task-${task.id}`;
        taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskItem.innerHTML = `
            <div class="flex items-center flex-grow">
                <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600 rounded mr-3 cursor-pointer" ${task.completed ? 'checked' : ''}>
                <span class="task-text text-lg text-gray-800 flex-grow">${task.text}</span>
            </div>
            <div class="flex space-x-2">
                <button class="edit-button bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" data-id="${task.id}" data-text="${task.text}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" />
                    </svg>
                </button>
                <button class="delete-button bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" data-id="${task.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;

        // Event listener for completion checkbox
        taskItem.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
            toggleTaskCompletion(task.id, task.completed);
        });

        // Event listener for edit button
        taskItem.querySelector('.edit-button').addEventListener('click', (e) => {
            taskToEditId = e.currentTarget.dataset.id;
            editTaskInput.value = e.currentTarget.dataset.text;
            showModal(editTaskModal);
        });

        // Event listener for delete button
        taskItem.querySelector('.delete-button').addEventListener('click', (e) => {
            taskToDeleteId = e.currentTarget.dataset.id;
            showModal(deleteConfirmModal);
        });

        taskList.appendChild(taskItem);
    });
}

// Function to break down a task using the Gemini API
async function breakDownTask() {
    const taskText = taskInput.value.trim();
    if (taskText === "") {
        console.log("Task text is empty for breakdown.");
        return;
    }

    breakdownButtonText.textContent = "Memecah...";
    breakdownSpinner.classList.remove('hidden');
    breakdownTaskButton.disabled = true; // Disable button while loading

    try {
        let chatHistory = [];
        const prompt = `Berikan saya daftar sub-tugas yang dapat ditindaklanjuti untuk tugas berikut: "${taskText}". Berikan hanya daftar sub-tugas dalam format JSON array of strings.`;
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: { "type": "STRING" }
                }
            }
        };
        const apiKey = ""; // API key will be provided automatically by Canvas
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const json = result.candidates[0].content.parts[0].text;
            const subtasks = JSON.parse(json);
            displaySubtasksInModal(subtasks);
            showModal(breakdownModal);
        } else {
            console.error("Unexpected response structure or missing content.");
            // Display an error message to the user if needed
        }
    } catch (error) {
        console.error("Error breaking down task with Gemini API: ", error);
        // Display an error message to the user if needed
    } finally {
        breakdownButtonText.textContent = "✨ Pecah Tugas";
        breakdownSpinner.classList.add('hidden');
        breakdownTaskButton.disabled = false; // Re-enable button
    }
}

// Function to display subtasks in the modal
function displaySubtasksInModal(subtasks) {
    subTaskList.innerHTML = '';
    if (subtasks.length === 0) {
        subTaskList.innerHTML = '<p class="text-gray-600">No sub-tasks suggested.</p>';
        return;
    }
    subtasks.forEach(subtask => {
        const subtaskItem = document.createElement('div');
        subtaskItem.className = 'flex items-center space-x-2 p-2 bg-gray-50 rounded-md';
        subtaskItem.innerHTML = `
            <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600 rounded" checked data-subtask-text="${subtask}">
            <span class="text-gray-800">${subtask}</span>
        `;
        subTaskList.appendChild(subtaskItem);
    });
}

// Function to add selected subtasks to the main task list
async function addSelectedSubtasks() {
    const checkboxes = subTaskList.querySelectorAll('input[type="checkbox"]:checked');
    for (const checkbox of checkboxes) {
        const subtaskText = checkbox.dataset.subtaskText;
        await addTask(subtaskText);
    }
    hideModal(breakdownModal);
    taskInput.value = ''; // Clear main input after adding subtasks
}

// Authentication and start listening for data changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        userIdDisplay.textContent = userId;

        // Unsubscribe from previous snapshot if any
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }

        // Listen for real-time data changes
        const q = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            const tasks = [];
            snapshot.forEach(doc => {
                tasks.push({ id: doc.id, ...doc.data() });
            });
            // Sort tasks by createdAt (newest on top)
            tasks.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
            displayTasks(tasks);
        }, (error) => {
            console.error("Error listening to snapshot: ", error);
        });
    } else {
        // If no user, try to sign in anonymously
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Error during sign-in: ", error);
            userIdDisplay.textContent = "Failed to load user ID.";
        }
    }
});

// Event listener for add task button
addTaskButton.addEventListener('click', () => addTask(taskInput.value));
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask(taskInput.value);
    }
});

// Event listener for breakdown task button
breakdownTaskButton.addEventListener('click', breakDownTask);

// Event listener for confirm delete button
confirmDeleteButton.addEventListener('click', deleteTask);

// Event listener for save edit button
saveEditButton.addEventListener('click', updateTask);
editTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        updateTask();
    }
});

// Event listener for add selected subtasks button
addSelectedSubtasksButton.addEventListener('click', addSelectedSubtasks);

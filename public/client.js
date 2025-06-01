// public/client.js
const socket = io();

// --- DOM Elements ---
const usernameModal = document.getElementById('username-modal');
const usernameInput = document.getElementById('username-input');
const setUsernameBtn = document.getElementById('set-username-btn');
const usernameError = document.getElementById('username-error');
const mainContent = document.getElementById('main-content');
const currentUsernameDisplay = document.getElementById('current-username-display');

const topicSelect = document.getElementById('topic-select');
const newTopicInput = document.getElementById('new-topic-input');
const createTopicBtn = document.getElementById('create-topic-btn');
const topicError = document.getElementById('topic-error');

const ideaForm = document.getElementById('idea-form');
const ideaInput = document.getElementById('idea-input');
const ideasByTopicContainer = document.getElementById('ideas-by-topic');
const noTopicsMessage = document.getElementById('no-topics-message');

const searchInput = document.getElementById('search-input');
const searchGoBtn = document.getElementById('search-go-btn');
const searchSuggestionsContainer = document.getElementById('search-suggestions');


// --- Global State ---
let currentUsername = localStorage.getItem('username'); // Try to load from local storage
let allTopics = [];
let allIdeas = [];

// --- Helper Functions ---
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function updateTopicSelect() {
    topicSelect.innerHTML = '<option value="">-- Select or Create New --</option>';
    allTopics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.name;
        topicSelect.appendChild(option);
    });
}

// --- THIS IS THE FUNCTION THAT WAS LIKELY UNDEFINED ---
function renderIdeasByTopic(filterTerm = '') {
    const searchTermLower = filterTerm.toLowerCase();
    ideasByTopicContainer.innerHTML = ''; // Clear existing content

    if (allTopics.length === 0) {
        noTopicsMessage.style.display = 'block';
        ideasByTopicContainer.appendChild(noTopicsMessage);
    } else {
        noTopicsMessage.style.display = 'none';
        allTopics.forEach(topic => {
            const topicSection = document.createElement('div');
            topicSection.classList.add('topic-section');
            topicSection.dataset.topicId = topic.id;
            topicSection.dataset.topicName = topic.name.toLowerCase(); // For search

            // Determine if the topic name itself matches the filter
            const topicNameMatches = topicSection.dataset.topicName.includes(searchTermLower);

            const topicHeader = document.createElement('h3');
            topicHeader.innerHTML = `${escapeHTML(topic.name)} <span class="toggle-icon">&#x25BC;</span>`; // Down arrow
            topicHeader.addEventListener('click', () => {
                const list = topicSection.querySelector('.topic-ideas-list');
                const icon = topicHeader.querySelector('.toggle-icon');
                if (list.style.display === 'none') {
                    list.style.display = 'block';
                    icon.innerHTML = '&#x25BC;'; // Down arrow
                } else {
                    list.style.display = 'none';
                    icon.innerHTML = '&#x25B6;'; // Right arrow
                }
            });
            topicSection.appendChild(topicHeader);

            const topicIdeasList = document.createElement('div');
            topicIdeasList.classList.add('topic-ideas-list');
            topicIdeasList.style.display = 'block'; // Default to open
            topicSection.appendChild(topicIdeasList);

            const ideasInTopic = allIdeas.filter(idea => idea.topicId === topic.id);
            let anyIdeaMatches = false;

            if (ideasInTopic.length === 0) {
                const noIdeasMsg = document.createElement('p');
                noIdeasMsg.classList.add('no-ideas-message-topic');
                noIdeasMsg.textContent = 'No ideas in this topic yet.';
                topicIdeasList.appendChild(noIdeasMsg);
            } else {
                ideasInTopic.forEach(idea => {
                    const ideaItem = document.createElement('div');
                    ideaItem.classList.add('idea-item');
                    ideaItem.dataset.ideaText = idea.text.toLowerCase(); // For search

                    // Determine if the idea text matches the filter
                    const ideaTextMatches = ideaItem.dataset.ideaText.includes(searchTermLower);

                    // Original (imperfect) filtering logic that caused the topic-idea mismatch
                    // We will re-apply the fix to this after getting it working again.
                    if (searchTermLower && !ideaTextMatches) {
                        ideaItem.classList.add('hidden-by-filter');
                    } else {
                        ideaItem.classList.remove('hidden-by-filter');
                        anyIdeaMatches = true;
                    }

                    ideaItem.innerHTML = `
                        <p class="idea-text">${escapeHTML(idea.text)}</p>
                        <div class="idea-meta">Posted by <span>${escapeHTML(idea.username)}</span> on ${idea.timestamp}</div>
                    `;
                    topicIdeasList.appendChild(ideaItem);
                });
            }

            // Decide if the entire topic section should be hidden
            // If the search term is active and neither the topic name nor any of its ideas match, hide the section.
            if (searchTermLower && !topicNameMatches && !anyIdeaMatches) {
                topicSection.classList.add('hidden-by-filter');
            } else {
                topicSection.classList.remove('hidden-by-filter');
                // Ensure topic ideas list is visible if filter reveals it
                topicSection.querySelector('.topic-ideas-list').style.display = 'block';
                topicSection.querySelector('.toggle-icon').innerHTML = '&#x25BC;';
            }

            ideasByTopicContainer.appendChild(topicSection);
        });
    }
}
// --- END OF THE FUNCTION THAT WAS LIKELY UNDEFINED ---


// --- Username Modal Logic ---
function showUsernameModal() {
    usernameModal.style.display = 'flex';
    mainContent.style.display = 'none';
}

function hideUsernameModal() {
    usernameModal.style.display = 'none';
    mainContent.style.display = 'block';
    currentUsernameDisplay.textContent = currentUsername;
}

setUsernameBtn.addEventListener('click', () => {
    const desiredUsername = usernameInput.value.trim();
    if (!desiredUsername) {
        usernameError.textContent = 'Username cannot be empty.';
        return;
    }

    socket.emit('check_username', desiredUsername, (isTaken) => {
        if (isTaken) {
            usernameError.textContent = 'That username is already taken. Please choose another.';
        } else {
            socket.emit('register_username', desiredUsername, (success) => {
                if (success) {
                    localStorage.setItem('username', desiredUsername);
                    currentUsername = desiredUsername;
                    hideUsernameModal();
                    usernameError.textContent = '';
                } else {
                    usernameError.textContent = 'Failed to register username (server error or race condition). Try again.';
                }
            });
        }
    });
});

// --- Topic Creation Logic ---
createTopicBtn.addEventListener('click', () => {
    const newTopicName = newTopicInput.value.trim();
    if (!newTopicName) {
        topicError.textContent = 'Topic name cannot be empty.';
        return;
    }

    socket.emit('create_topic', newTopicName, (response) => {
        if (response.success) {
            newTopicInput.value = '';
            topicError.textContent = '';
            topicSelect.value = response.topic.id;
        } else {
            topicError.textContent = response.message;
            if (response.topic) {
                topicSelect.value = response.topic.id;
            }
        }
    });
});

// --- Idea Form Submission Logic ---
ideaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ideaText = ideaInput.value.trim();
    const selectedTopicId = topicSelect.value;

    if (!currentUsername) {
        alert('Please set your username first!');
        showUsernameModal();
        return;
    }
    if (!ideaText) {
        alert('Please enter an idea!');
        return;
    }
    if (!selectedTopicId) {
        alert('Please select an existing topic or create a new one!');
        return;
    }

    socket.emit('new_idea', { ideaText, topicId: selectedTopicId, username: currentUsername });
    ideaInput.value = '';
});

// --- Search/Filter Logic (Updated) ---
function applySearchFilter() {
    const searchTerm = searchInput.value;
    renderIdeasByTopic(searchTerm);
    searchSuggestionsContainer.innerHTML = ''; // Hide suggestions after search
}

searchGoBtn.addEventListener('click', applySearchFilter);

// Allow Enter key to trigger search in the input field
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        applySearchFilter();
        // Prevent default form submission if it's implicitly part of a form
        e.preventDefault();
    }
});


// --- Search Suggestions Logic (New) ---
searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    searchSuggestionsContainer.innerHTML = ''; // Clear previous suggestions

    if (searchTerm.length === 0) {
        return; // No suggestions for empty search term
    }

    const matchedSuggestions = [];
    const maxSuggestions = 10; // Limit suggestions for performance/UI

    // Suggest topics
    allTopics.forEach(topic => {
        if (topic.name.toLowerCase().includes(searchTerm)) {
            matchedSuggestions.push({ type: 'topic', name: topic.name, id: topic.id });
        }
    });

    // Suggest ideas
    allIdeas.forEach(idea => {
        if (idea.text.toLowerCase().includes(searchTerm)) {
            matchedSuggestions.push({ type: 'idea', name: idea.text, id: idea.id, topicName: allTopics.find(t => t.id === idea.topicId)?.name });
        }
    });

    // Sort suggestions (e.g., topics first, then by match quality)
    matchedSuggestions.sort((a, b) => {
        if (a.type === 'topic' && b.type !== 'topic') return -1;
        if (a.type !== 'topic' && b.type === 'topic') return 1;
        // Basic alphabetical sort for same type
        return a.name.localeCompare(b.name);
    });


    // Render suggestions
    const ul = document.createElement('ul');
    matchedSuggestions.slice(0, maxSuggestions).forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion.name;
        const typeSpan = document.createElement('span');
        typeSpan.classList.add('suggestion-type');

        if (suggestion.type === 'topic') {
            typeSpan.textContent = '(Topic)';
            li.dataset.suggestionValue = suggestion.name; // Use topic name for setting input
            li.dataset.suggestionType = 'topic';
        } else {
            typeSpan.textContent = `(Idea in ${escapeHTML(suggestion.topicName || 'Unknown Topic')})`;
            li.dataset.suggestionValue = suggestion.name; // Use idea text for setting input
            li.dataset.suggestionType = 'idea';
        }
        li.appendChild(typeSpan);


        li.addEventListener('click', () => {
            searchInput.value = li.dataset.suggestionValue; // Set search input to suggestion text
            searchSuggestionsContainer.innerHTML = ''; // Hide suggestions
            applySearchFilter(); // Perform the search
        });
        ul.appendChild(li);
    });

    if (matchedSuggestions.length > 0) {
        searchSuggestionsContainer.appendChild(ul);
    }
});

// Hide suggestions when clicking outside the search area
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container') && searchSuggestionsContainer.innerHTML !== '') {
        searchSuggestionsContainer.innerHTML = '';
    }
});


// --- Socket.IO Event Listeners ---

// Initial data from server (on connection)
socket.on('initial_data', (data) => {
    allTopics = data.topics;
    allIdeas = data.ideas;
    updateTopicSelect();
    renderIdeasByTopic(); // Initial render without filter
});

// When a new topic is created by any user
socket.on('topic_created', (newTopic) => {
    allTopics.push(newTopic);
    updateTopicSelect();
    renderIdeasByTopic(searchInput.value); // Re-render with current filter
});

// When a new idea is added by any user
socket.on('idea_added', (newIdea) => {
    allIdeas.unshift(newIdea); // Add to the beginning for newest first
    renderIdeasByTopic(searchInput.value); // Re-render with current filter
});

// --- Initialization on page load ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUsername) {
        showUsernameModal();
    } else {
        hideUsernameModal();
    }
});

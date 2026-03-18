const COMMENTS_API = '/comments';

// DOM
const commentsDialog    = document.getElementById('commentsDialog');
const commentsTaskLabel = document.getElementById('commentsTaskLabel');
const commentsList      = document.getElementById('commentsList');
const commentForm       = document.getElementById('commentForm');
const commentMessage    = document.getElementById('commentMessage');
const commentError      = document.getElementById('commentError');
const commentSubmitBtn  = document.getElementById('commentSubmitBtn');
const closeCommentsBtn  = document.getElementById('closeCommentsBtn');


// API app.js

// Función genérica para llamadas a la API de comentarios (me lo hubiera ahorrado si usaba fetch directo desde el principio...)
async function commentsFetch(path, options = {}, signal = null) {
  const config = {
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(path, config);

  let data;
  try { data = await res.json(); }
  catch { data = null; }

  if (!res.ok) {
    if (res.status === 401) { window.location.href = '/pages/login.html'; return; }
    throw new Error(data?.error || 'HTTP ' + res.status);
  }

  return data;
}

const CommentsAPI = {
  getComments: (taskUid, signal) => commentsFetch('/comments?taskUid=' + taskUid, {},                            signal),
  createComment: (data,   signal) => commentsFetch('/comments',                  { method: 'POST', body: data }, signal),
  deleteComment: (id,     signal) => commentsFetch('/comments/' + id,            { method: 'DELETE' },           signal),
};

// Local state
let activeTaskUid = null;
let activeTaskTitle = '';


// Helpers

function setCommentError(message) {
    commentError.textContent = message || '';
}

// de fecha a "hace X minutos"
function formatRelativeDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0) return diffDay + ' day' + (diffDay > 1 ? 's' : '') + ' ago';
    if (diffHour > 0) return diffHour + ' hour' + (diffHour > 1 ? 's' : '') + ' ago';
    if (diffMin > 0) return diffMin + ' minute' + (diffMin > 1 ? 's' : '') + ' ago';

    // mas de una semana fecha exacta
    if (diffSec > 7 * 24 * 60 * 60) {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    return 'Just now';
}

// Render

// Render para comentario
function createCommentElement(comment) {
    const isReply = comment.parentId !== null;
    const isDeleted = comment.deleted;
    const canDelete = !isDeleted && (currentUser && currentUser.username === comment.username);


    const li = document.createElement('li');
    li.className = 'comment' + (isReply ? ' is-reply' : '') + (isDeleted ? ' deleted' : '');
    li.dataset.id = comment.id;

    // Si esta eliminado placeholder
    const authorText  = escapeHtml(isDeleted ? 'Deleted' : comment.username);
    const messageText = escapeHtml(isDeleted ? '[Comment deleted]' : comment.message);
    const dateText    = formatRelativeDate(comment.date);

    li.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${authorText}</span>
      <time class="comment-date" datetime="${comment.date}">${dateText}</time>
    </div>
    <p class="comment-message">${messageText}</p>
    <div class="comment-actions" role="group" aria-label="Acciones del comentario">
      ${!isDeleted && !isReply
        ? `<button class="comment-btn reply-btn"
                   data-action="reply"
                   data-id="${comment.id}"
                   aria-label="Responder al comentario de ${authorText}">
             Responder
           </button>`
        : ''}
      ${canDelete && !isDeleted
        ? `<button class="comment-btn delete"
                    data-action="delete-comment"
                    data-id="${comment.id}"
                    aria-label="Eliminar comentario">
            Eliminar
            </button>`
        : ''}
    </div>
  `;

  return li;
}

// Render lista de comentarios
function renderComments(comments) {
    commentsList.innerHTML = '';

    const rootComments = comments.filter(c => c.parentId === null);
    const replies = comments.filter(c => c.parentId !== null);

    if (rootComments.length === 0 && replies.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'comments-reply';
        empty.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M4 4h24v18H18l-6 6v-6H4z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        </svg>
        <span>No hay comentarios aún</span>`;
        commentsList.appendChild(empty);
        return;
    }

    // orden
    rootComments.sort((a, b) => new Date(b.date) - new Date(a.date));
    rootComments.forEach(function(rootcomment) {
        commentsList.appendChild(createCommentElement(rootcomment));

        // Render respuestas a este comentario
        const commentReplies = replies.filter(r => r.parentId === rootcomment.id);
        commentReplies.sort((a, b) => new Date(a.date) - new Date(b.date));
        commentReplies.forEach(function(reply) {
            commentsList.appendChild(createCommentElement(reply));
        });
    });
}

// skeletons
function renderCommentsLoading() {
  commentsList.innerHTML = `
    <li class="comment-skeleton"></li>
    <li class="comment-skeleton"></li>
    <li class="comment-skeleton"></li>
  `;
}

// Form para comentar
function openReplyForm(parentId, parentElement) {
    // Si ya hay un form abierto, cerrarlo
    const existingForm = document.getElementById('replyForm');
    if (existingForm) {
        existingForm.remove();
    }

    const form = document.createElement('form');
    form.className = 'reply-form';
    form.dataset.parentId

    form.innerHTML = `
        <textarea class="reply-message" rows="2"
              placeholder="Escribe tu respuesta... (mín. 5 caracteres)"
              maxlength="500" aria-label="Mensaje de la respuesta"></textarea>

        <p class="field-error reply-error" role="alert" aria-live="assertive"></p>
        <div class="reply-form-footer">
            <button type="button" class="btn-ghost reply-cancel" style="font-size:12px;padding:5px 10px;">
                Cancelar
            </button>
            <button type="button" class="btn-primary reply-submit" style="font-size:12px;padding:5px 12px;">
                Responder
            </button>
        </div>
    `;

    let insertAfter = parentElement;
    let next = parentElement.nextElementSibling;
    while (next && next.classList.contains('is-reply')) {
        insertAfter = next;
        next = next.nextElementSibling;
    }
 
    insertAfter.insertAdjacentElement('afterend', form);
    form.querySelector('.reply-message').focus();
    
    // Cancelar
    form.querySelector('.reply-cancel').addEventListener('click', function() {
        form.remove();
    });

    // Enviar respuesta
    form.querySelector('.reply-submit').addEventListener('click', async function() {
        const message = form.querySelector('.reply-message').value.trim();
        const errorEl = form.querySelector('.reply-error');

        const validationError = validateComment(message);

        if (validationError) {
            errorEl.textContent = validationError;
            return;
        }

        errorEl.textContent = '';
        const submitBtn = form.querySelector('.reply-submit');
        submitBtn.disabled = true;
    
        const ctrl = new AbortController();

        try {
            await CommentsAPI.createComment({
                taskUid:  activeTaskUid,
                parentId: parentId,
                username: currentUser.username,
                message: message.trim()
            }, ctrl.signal);

            form.remove();
            await loadComments(activeTaskUid);
            showToast('Respuesta publicada');
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Error creando respuesta:', err);
            errorEl.textContent = err.error || 'Error al publicar la respuesta';
            submitBtn.disabled = false;
        }
    });
}

// Validación de comentario

function validateComment(message) {
  if (!message || message.trim().length < 5) return 'El mensaje debe tener al menos 5 caracteres.';
  if (message.trim().length > 500)   return 'El mensaje no puede tener más de 500 caracteres.';
  return null;
}


// GET POST DELETE Comments
// Cargar comentarios
async function loadComments(taskUid) {
  renderCommentsLoading();
 
  const ctrl = new AbortController();
 
  try {
    const comments = await CommentsAPI.getComments(taskUid, ctrl.signal);
    renderComments(comments);
  } catch (err) {
    if (err.name === 'AbortError') return;
    commentsList.innerHTML = `<li class="comments-empty"><span>Error al cargar comentarios</span></li>`;
    console.error('Error loading comments:', err);
  }
}
 
// subir comentario nuevo
async function submitComment() {
  const message  = commentMessage.value;
 
  const validationError = validateComment(message);
  if (validationError) {
    setCommentError(validationError);
    commentMessage.focus();
    return;
  }
 
  setCommentError(null);
  commentSubmitBtn.disabled = true;
 
  const ctrl = new AbortController();
 
  try {
    await CommentsAPI.createComment({
      taskUid:  activeTaskUid,
      parentId: null,             // comentario raiz
      username: currentUser.username,
      message:  message.trim(),
      date:     new Date().toISOString(),
    }, ctrl.signal);
 
    // Limpiar form y recargar lista
    commentMessage.value = '';
    setCommentError(null);
    await loadComments(activeTaskUid);
    showToast('Comentario publicado');
 
  } catch (err) {
    if (err.name === 'AbortError') return;
    setCommentError('Error al publicar: ' + err.message);
  } finally {
    commentSubmitBtn.disabled = false;
  }
}

// Eliminar comentario
async function deleteComment(id) {
  // Confirmacion antes de eliminar
  const confirmed = window.confirm('¿Eliminar este comentario?');
  if (!confirmed) return;
 
  const ctrl = new AbortController();
 
  try {
    await CommentsAPI.deleteComment(id, ctrl.signal);
    await loadComments(activeTaskUid); 
    showToast('Comentario eliminado');
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast('Error al eliminar: ' + err.message, true);
  }
}


// dialog

function closeReplyForms() {
  document.querySelectorAll('.reply-form').forEach(function(f) { f.remove(); });
}

function openCommentsDialog(taskUid, taskTitle) {
  activeTaskUid    = taskUid;
  activeTaskTitle = taskTitle;
 
  // Actualizar el label del dialog con la task activa
  commentsTaskLabel.textContent = 'TASK-' + String(taskUid).padStart(3, '0');
  document.getElementById('comments-dialog-title').textContent =
    escapeHtml(taskTitle) || 'Comentarios';
 
  // Limpiar form
  commentMessage.value = '';
  setCommentError(null);
  closeReplyForms();
 
  commentsDialog.showModal();
  loadComments(taskUid);
}
 
function closeCommentsDialog() {
  commentsDialog.close();
  closeReplyForms();
  activeTaskUid = null;
}


// Cerrar con el boton X
closeCommentsBtn.addEventListener('click', closeCommentsDialog);
 
// Cerrar al hacer click en el backdrop
commentsDialog.addEventListener('click', function(e) {
  if (e.target === commentsDialog) closeCommentsDialog();
});
 
// Submit del form principal
commentForm.addEventListener('submit', function(e) {
  e.preventDefault();
  submitComment();
});
 
// Limpiar error al escribir
commentMessage.addEventListener('input', function() {
  if (commentError.textContent) setCommentError(null);
});
 
// Delegar botones
commentsList.addEventListener('click', function(e) {
  const replyBtn  = e.target.closest('[data-action="reply"]');
  const deleteBtn = e.target.closest('[data-action="delete-comment"]');
 
  if (replyBtn) {
    const parentId = parseInt(replyBtn.dataset.id);
    const parentEl = replyBtn.closest('.comment');
    openReplyForm(parentId, parentEl);
    return;
  }
 
  if (deleteBtn) {
    deleteComment(parseInt(deleteBtn.dataset.id));
    return;
  }
});
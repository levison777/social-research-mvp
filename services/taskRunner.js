function listTasks(runtime, options = {}) {
  return runtime.getTaskList(options);
}

function getTask(runtime, taskId) {
  return runtime.getTaskById(taskId);
}

function createTask(runtime, body) {
  return runtime.createTaskFromBody(body);
}

function deleteTask(runtime, taskId) {
  return runtime.deleteTaskById(taskId);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  deleteTask
};

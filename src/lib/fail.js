/*
带状态码的错误。用户填错了带 400 或 404，程序自己坏了不带，入口按这个码把原因返回去。
调用示例：
  throw fail(400, 'Invalid path')
*/

export function fail(status, message) {
  const error = new Error(message);   // 原因写在消息里，调用方不用再拆
  error.status = status;              // 入口只认这个码，400 是用户能改的，500 是程序故障
  return error;
}

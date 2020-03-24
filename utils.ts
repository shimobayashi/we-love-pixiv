// console.log系を生かしておくとミスってGitHub Actionsに意図しないログが大公開されてしまう可能性があるため、
// 基本的にはconsole.log系は何もしないようにしておく。
export const log_safe_content = console.log; // 大丈夫そうなやつはこのメソッドを使ってロギングする
export const debugMode:boolean = !!(process.env.DEBUG && process.env.DEBUG === '1'); // headlessもこれで制御しているので注意

if (!debugMode) {
  console.debug = function(){/* NOP */};
  console.info = function(){/* NOP */};
  console.log = function(){/* NOP */};
  console.warn = function(){/* NOP */};
  console.error = function(){/* NOP */};
}
(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,58776,e=>{"use strict";let t=null,r=null,s=!1;async function n(){return t||(r||(r=(async()=>{if("function"!=typeof self.loadPyodide&&self.importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js"),"function"!=typeof self.loadPyodide)throw Error("Failed to initialize Pyodide.");return t=await self.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.27.2/full/"})})()),r)}self.onmessage=async e=>{let{id:t,request:r}=e.data;try{let e=await n();s||(self.postMessage({kind:"runtime-status",status:"ready"}),s=!0),e.globals.set("__runner_source",r.pythonCode),e.globals.set("__runner_stdin_json",JSON.stringify(r.stdinLines)),e.globals.set("__runner_vfs_json",JSON.stringify(r.virtualFiles));let i=await e.runPythonAsync(`
import json
import traceback

_runtime_stdin = json.loads(__runner_stdin_json)
_runtime_vfs = json.loads(__runner_vfs_json)
_runtime_globals = {
    "__stdin_lines": _runtime_stdin,
    "__virtual_files": _runtime_vfs,
}
_runtime_error = ""

try:
    exec(__runner_source, _runtime_globals, _runtime_globals)
except Exception:
    _runtime_error = traceback.format_exc()

_runtime_out = _runtime_globals.get("__stdout", [])
_runtime_vfs_out = _runtime_globals.get("__vfs", _runtime_globals.get("__virtual_files", {}))
{
    "stdout": "\\n".join(str(value) for value in _runtime_out),
    "error": _runtime_error,
    "vfs": {str(name): list(values) for name, values in _runtime_vfs_out.items()},
}
`),o=i.toJs?i.toJs({dict_converter:Object.fromEntries}):i;i.destroy&&i.destroy();let l=function(e){if(!e.trim())return[];let t=e.match(/line (\d+)/),r=t?Number.parseInt(t[1],10):1;return[{code:"RUN001",message:e.split("\n").slice(-2).join(" ").trim()||"Runtime error",severity:"error",line:r,column:1,endLine:r,endColumn:1,hint:"Inspect generated Python and runtime state."}]}(String(o.error??"")),u={success:0===l.length,stdout:String(o.stdout??""),stderr:String(o.error??""),diagnostics:l,virtualFiles:o.vfs??{}};self.postMessage({kind:"run-result",id:t,result:u})}catch(n){let e=n instanceof Error?n.message:"Unknown worker error",s={success:!1,stdout:"",stderr:e,diagnostics:[{code:"RUN500",message:e,severity:"error",line:1,column:1,endLine:1,endColumn:1}],virtualFiles:r.virtualFiles};self.postMessage({kind:"run-result",id:t,result:s})}},e.s([])}]);
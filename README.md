# TerraMind

产品方向：自然语言驱动的实时 3D 场景创作工具。核心是创建、选择、修改和保存场景物体，不再以生态模拟器为主线。

## 当前版本：V0.5 真实模型网关与安全提案

- index.html / view.mjs：Three.js 场景工作台、物体选择、移动/旋转/缩放操纵器、属性面板、AI 规划请求、操作预览与确认、撤销/重做和本地保存。
- scene.mjs：确定性场景数据模型、实体校验、快照恢复和原子化操作。
- semantic-index.mjs：场景实体、组合组、类型别名和上下文指代解析；对多候选目标拒绝猜测。
- assistant.mjs：本地语义规划、相对位置计算、多轮上下文、预览确认、过期计划检测和模型提案校验。
- llm-contract.mjs：模型 Function Calling 工具契约。
- llm-provider.mjs：Chat Completions / Responses 双协议适配、场景上下文打包、超时、响应解析和错误处理。
- server.mjs：本机 Node HTTP 服务、AI 规划 API、配置健康检查、同源校验、限流、静态文件白名单。
- test-llm-provider.mjs / test-server.mjs：模拟模型响应的网关与 HTTP 安全测试。
- engine.mjs / protocol.mjs：旧生态模拟实验，保留但不再由主界面加载。

## 启动方式
需要 Node.js 22。首次配置：

~~~powershell
Copy-Item .env.example .env
~~~

编辑 .env，填写模型服务商提供的 API Key 和模型标识。默认使用 OpenAI-compatible Chat Completions；如果所用模型/服务商只支持 Responses API，则设置 TERRAMIND_API_MODE=responses。具体说明见 docs/V0.5-LLM-GATEWAY.md。

启动服务：

~~~bash
node --env-file=.env server.mjs
~~~

浏览器访问 http://127.0.0.1:8000。不配置 API Key 时，服务仍可启动，界面会回退到有限的本地规则规划器。

## 安全执行流程
用户指令 → 场景上下文 → 模型 Function Calling → 服务端结构校验 → 场景快照验证 → 浏览器预览 → 用户确认 → commitPlan

模型没有直接写入场景的权限，不能执行生成代码。场景在生成预览后发生变化时，旧计划会失效。

## 当前支持的 AI 能力
- 读取物体名称、类型、位置、旋转、缩放、材质、颜色、组合关系及考虑旋转的保守世界包围盒。
- 结合选中物体和最近八条对话消息（通常为四轮用户/助手往返）理解多轮指代。
- 为创建、修改、删除基础几何体生成结构化操作提案。
- 在 Chat Completions 和 Responses 两种 API 协议之间切换。
- API 不可用或未配置时，回退到本地规则规划器。

当前模型输入是结构化场景数据，不包含三维视口截图；因此还没有真正的视觉场景理解能力。支持的几何体仍限于 box、sphere、cylinder、cone。

## 自动化测试
~~~bash
node test.mjs
node test-protocol.mjs
node test-scene.mjs
node test-intent.mjs
node test-assistant.mjs
node test-llm-provider.mjs
node test-server.mjs
~~~

## 验证边界
V0.5 新增网关与服务器测试采用 mock provider，不会消耗真实 Token。测试覆盖协议请求结构、Chat Completions / Responses 返回解析、提案验证、认证错误脱敏、同源检查、静态资源白名单和未配置模型时的行为。真实模型调用、真实 API Key/额度、真实浏览器交互、跨设备兼容性、视觉质量和性能仍需实机验收。

开发服务器仅允许绑定本机回环地址，不是可直接公开部署的生产服务。公开部署前必须补充用户认证、授权、HTTPS 反向代理及生产级限流。

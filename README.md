# TerraMind

**产品方向：** 自然语言驱动的实时 3D 场景创作工具。核心是创建、选择、修改和保存场景物体，不再以生态模拟器为主线。

## 当前版本：V0.3 场景编辑器切片

- `index.html` / `view.mjs`：Three.js 场景工作台、物体选择、移动/旋转/缩放操纵器、属性面板、撤销/重做和本地保存。
- `scene.mjs`：确定性场景数据模型、实体校验、快照恢复和原子化操作。
- `intent.mjs`：受约束的中文自然语言指令解析，转换为结构化场景操作。
- `test-scene.mjs` / `test-intent.mjs`：场景模型与指令规划测试。
- `engine.mjs` / `protocol.mjs`：旧生态模拟实验，保留但不再由主界面加载。

## 支持的指令样例

- 创建红色立方体 / 创建蓝色球体 / 创建绿色圆柱体
- 在桌面上放一座红色城堡
- 把最后一个物体改成白色
- 把城堡改成白色（整组修改）
- 把城堡主楼改成白色（单个部件修改）
- 把城堡移动到左边 / 把城堡放大一倍
- 把最后一个物体移动到左边
- 把最后一个物体放大一倍
- 删除最后一个物体

当前城堡由基础几何体组合而成；中文解析器是本地规则实现，**尚未接入大模型**，不支持任意自然语言。

## 本地运行

在项目目录启动静态服务器：

```bash
python -m http.server 8000
```

打开 `http://localhost:8000`。当前 Three.js 通过 jsDelivr 加载，因此需要网络连接和支持 WebGL 的浏览器。

## 自动化测试

```bash
node test.mjs
node test-protocol.mjs
node test-scene.mjs
node test-intent.mjs
```

## 验证边界

本轮已完成 Node.js 场景与指令测试、旧生态引擎回归测试以及 `view.mjs` 语法检查。尚未完成真实浏览器中的交互验收、跨设备检查、帧率测量和视觉质量评估。大模型 Function Calling 仍属于后续工作。

详见 [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md)。

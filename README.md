# size-assistant · 尺码小助手

Qoder CLI / Qoder Desktop 的技能包。把身材数据、商品尺码表、买家评论噪声，换算成**「买哪个码 + 依据 + 备选 + 风险」**。

不是"尺码对照查询表"。核心立场是：**cm 是唯一可信的通货，所有码数标签都是不可靠的别名**——任何跨系统换算必须先落到 cm，再落到目标码，跳过这一步必然出错。

## 能做什么

| 场景 | 例子 |
|---|---|
| 服装码数推荐 | "175 / 70kg 买 M 还是 L" → 给号型、建议码、所需成衣胸围区间 |
| 商品页尺码表解读 | 贴表格文字或截图，先判读数字属于**成衣实测**还是**净体身材**，再定码 |
| 跨国码数换算 | CN 号型 / EU / US / UK / JP / 意码 之间往返 |
| 评论偏码分析 | "评论都说偏小"→ 按有效样本与体型分段判断该不该 ±1 码 |
| 风险修正 | 面料水洗缩水、氨纶弹性、落肩款肩宽失效、B/C 体腰围不足 |
| 专项换算 | 裤腰 cm↔市尺↔英寸 W、鞋码与内长、内衣下胸围+罩杯、戒指圈号 |

## 安装

Qoder 的用户级技能目录是 `~/.qoder-cn/skills/`（Windows 为 `C:\Users\<你>\.qoder-cn\skills\`）。

```bash
git clone https://github.com/feiyu831143/size-assistant.git ~/.qoder-cn/skills/size-assistant
```

目录名必须是 `size-assistant`（与 SKILL.md 的 `name` 一致），否则不会被加载。装完重启会话或执行 `/skills reload`，用 `/size-assistant` 调用，或直接说"帮我看看这件会不会偏小"。

已有本地开发副本时，用目录联接代替拷贝，改仓库即刻生效。需在 cmd 中执行（Git Bash 会把 `/J` 当路径转换而报「无效开关」）：

```bat
:: Windows，无需管理员权限
mklink /J "%USERPROFILE%\.qoder-cn\skills\size-assistant" "<仓库绝对路径>\size-assistant"
```

建完用 `dir "%USERPROFILE%\.qoder-cn\skills"` 确认该项显示为 `<JUNCTION>`，且 `SKILL.md` 可透过联接读到。

## 依赖

脚本只有 Node.js（>= 16）一个依赖，无第三方包：

```bash
node --no-warnings scripts/size.cjs            # 列出全部子命令
node --no-warnings scripts/size.cjs body 175 70
node --no-warnings scripts/size.cjs top --chest 92 --height 175 --waist 84 --type down
node --no-warnings scripts/size.cjs shoe --foot 26.3
node --no-warnings scripts/size.cjs pants --waist 76 --hip 96
node --no-warnings scripts/size.cjs ease --garment 104 --body 92 --type shirt
node --no-warnings scripts/size.cjs shrink --garment 104 --body 92 --fabric linen --type shirt
node --no-warnings scripts/size.cjs ring --diameter 17.5
node --no-warnings scripts/size.cjs unit 70 kg jin
```

## 目录结构

```
SKILL.md                      技能入口：原则 + 四个工作流
scripts/size.cjs              换算与判定计算（8 个子命令）
references/tables.md          号型/字母/鞋码/裤装/戒指/罩杯对照、松量区间、缩水率
references/measure.md         平铺成衣量法、净体测量要点、数据完整度→置信度分级
references/product-page.md    尺码表语义判读、口径陷阱、分品类核对优先级
references/review-analysis.md 评论抽取字段、判定门槛、八类统计偏差、错表校验
```

`references/` 按需加载，`scripts/` 可直接执行不占上下文。

## 关于数据可信度

- 鞋码 EU / CN / JP 三列由长度公式锚定（`EU = 1.5 × (脚长cm + 1.5)`、`CN 旧码 = 2 × 脚长cm − 10`），可互相换算。
- **US / UK 不给单一值**，只给基数并标注各品牌标法互差 ±1（Nike 女码 = 男码 +1，通用表 +1.5）。这不是偷懒，是该体系本身不一致。
- 戒指港码、各品牌自有尺码表**有意不内置**：这些表每年改版，内置过时数据比不内置更容易误导。使用时把商品页的表贴给技能即可。
- 身高体重推算净体尺寸是群体回归，男性 ±3 cm、女性 ±6 cm（罩杯差异主导）。有实测数据时一律以实测为准。

## 迭代方向

`references/` 与脚本中的阈值目前基于通用成衣公差与国标号型，欢迎就以下方面提 issue 或 PR：

- 具体品牌/楦型的实测偏移数据（希望以"品牌 + 款型 + 偏移量"的可验证形式，而不是"感觉偏大"）
- 更多品类的松量区间（冲锋衣、西装、婚纱礼服、孕产装、童装放码）
- 非中文市场的号型体系（俄码、韩码、巴西码、墨码）
- 评论偏码判定的门槛校准（当前：同向 ≥60% 且有效样本 ≥10）

## License

MIT

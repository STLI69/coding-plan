/**
 * 空壳插件。
 *
 * 本包的行为全部由 cordis.patch.yml 承担；这个文件存在的唯一理由是：
 * patch 里 insert 了一行 name 指向本包的空壳行，而 Loader 需要能 import 到
 * 一个真实模块才会让该行激活 —— 激活后才算一个 Loader entry，也才会出现在
 * 「设置 → 插件 → 插件列表」里，用户才能看见并卸载本包。
 *
 * apply 故意什么都不做：不注册工具、不发事件、不持有状态。
 */
export default {
  name: '@dsh-ark-agent/coding-plan',
  apply() {},
}

export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment
	| typeof ContextProvider

export const FunctionComponent = 0
export const HostRoot = 3 // ReactDom.render(document.getElementById('root')) 中的根节点 root
export const HostComponent = 5 //	比如 <div> 对应的fiber 就是HostComponent
export const HostText = 6 // <div>123</div> 这个123的类型就是HostText
export const Fragment = 7
export const ContextProvider = 8

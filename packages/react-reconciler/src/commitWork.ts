import {FunctionComponent, HostComponent, HostRoot, HostText} from './workTags'
import {FiberNode, FiberRootNode, pendingPassiveEffects} from './fiber'
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Update
} from './fiberFlags'
import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig'
import {Effect, FCUpdateQueue} from './fiberHooks'
import {HookHasEffect} from './hookEffectTags'

let nextEffect: FiberNode | null = null

// commit 阶段数据突变的副作用处理
export function commitMutationEffects(
	finishedWork: FiberNode,
	root: FiberRootNode
) {
	nextEffect = finishedWork

	while (nextEffect !== null) {
		// 向下遍历 一直找到没有subtreeFlags的节点结束 再往上遍历
		const child: FiberNode | null = nextEffect.child

		if (
			(nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
			child !== null
		) {
			//  存在【MutationMask】和【PassiveMask】的subtreeFlags就赋值给nextEffect 继续往下
			nextEffect = child
		} else {
			/**
			 * 要么到叶子节点了，要么不包含substreeFlags
			 * 但是可能存在flags
			 *  向上遍历 DFS 深度优先遍历
			 */
			up: while (nextEffect !== null) {
				commitMutaitonEffectsOnFiber(nextEffect, root)
				const sibling: FiberNode | null = nextEffect.sibling
				if (sibling !== null) {
					nextEffect = sibling
					break up
				}
				nextEffect = nextEffect.return
			}
		}
	}
}

function commitMutaitonEffectsOnFiber(
	finishedWork: FiberNode,
	root: FiberRootNode
) {
	const flags = finishedWork.flags
	// 1、判断flags中包含Placement的副作用 则执行插入操作
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		// 执行完之后从workInProgress的flags中移除Placement
		finishedWork.flags &= ~Placement
	}

	// 2、flags 中 Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork)
		// 执行完之后从workInProgress的flags中移除Update
		finishedWork.flags &= ~Update
	}

	// 3、flags 中 ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions
		// 需要处理所有子树中的unmout、解绑ref等
		if (deletions !== null) {
			deletions.forEach((childToDeletion) => {
				commitChildDeletion(childToDeletion, root)
			})
		}
		// 执行完之后从workInProgress的flags中移除Update
		finishedWork.flags &= ~ChildDeletion
	}

	// 4、flags 中 PassiveEffect
	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集回调
		commitPassiveEffect(finishedWork, root, 'update')
		//	收集结束要移除flags PassiveEffect
		finishedWork.flags &= ~PassiveEffect
	}
}

//	收集回调
function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof pendingPassiveEffects
) {
	// 	update unmount
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return
	}
	//	对于FunctionComponent 副作用保存在 updateQueue中
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在effect')
		}
		// 收集到FiberRootNode中的pendingPassiveEffects中
		root.pendingPassiveEffects.update.push(updateQueue.lastEffect as Effect)
	}
}

//	遍历effect环状链表
function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect
	do {
		if ((effect.tag & flags) === flags) {
			callback(effect)
		}
		effect = effect.next as Effect
	} while (effect !== lastEffect.next)
}

// 组件卸载时执行destroy
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy
		if (typeof destroy === 'function') {
			destroy()
		}
		//	unmount时 说明此组件已经卸载 下一次更新不会再触发create 则要移除HookHasEffect
		effect.tag &= ~HookHasEffect
	})
}

//	触发上次更新生成的所有destroy
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy
		if (typeof destroy === 'function') {
			destroy()
		}
	})
}

//	触发本次更新的所有create
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create
		if (typeof create === 'function') {
			effect.destroy = create()
		}
	})
}

// 记录要删除的同级的所有节点
function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	/**
	 * 1、找到第一个root Host
	 * 2、没找到一个host节点 就要判断是不是第1步找到的节点的兄弟节点
	 * */
	const lastOne = childrenToDelete[childrenToDelete.length - 1]
	if (!lastOne) {
		//不存在说明此次是找到的第一个节点
		childrenToDelete.push(unmountFiber)
	} else {
		// 如果存在 说明此次不是第一个 就要判断这个unmountFiber是不是兄弟节点
		let node = lastOne.sibling
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber)
			}
			node = node.sibling
		}
	}
}

function commitChildDeletion(childToDeletion: FiberNode, root: FiberRootNode) {
	/**
	 * 对于标记ChildDeletion的子树，由于子树中：
	 * 1、对于FC，需要处理useEffect unmout执行、解绑ref
	 * 2、对于HostComponent，需要解绑ref
	 * 3、对于子树的根HostComponent，才是需要移除的DOM
	 * 注意：所以需要实现「遍历ChildDeletion子树」的流程
	 * */
	// 定义这颗子树的根节点 即需要删除的子树的根节点 但是现在可能存在1个或者是Fragment包裹起来的多个
	const rootChildrenToDelete: FiberNode[] | null = []

	// 1、递归子树
	commitNestedComponent(childToDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				// todo 解绑ref
				return
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				return
			case FunctionComponent:
				// todo 解绑ref
				commitPassiveEffect(unmountFiber, root, 'unmount')
				break
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber)
				}
		}
	})

	// 2、rootChildrenToDelete中有数据 则遍历移除
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDeletion)
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent)
			})
		}
	}
	childToDeletion.return = null
	childToDeletion.child = null
}

// DFS 深度优先遍历
function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root
	while (true) {
		// 每遍历到一个节点 都会执行一下onCommitUnmount
		onCommitUnmount(node)

		// 1、如果存在子节点 则向下遍历
		if (node.child !== null) {
			// 向下遍历
			node.child.return = node
			node = node.child
			continue
		}

		//	2、经过第1步后，node === root 直接终止
		if (node === root) {
			return
		}

		// 没有兄弟节点，就把node.return 赋值给 node 往上
		while (node.sibling === null) {
			// 终止条件
			if (node.return === root || node.return === null) {
				return
			}
			//	向上归
			node = node.return
		}
		node.sibling.return = node.return
		node = node.sibling
	}
}

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork)
	}
	// 1、找到parent DOM
	const hostParent = getHostParent(finishedWork)

	// 2、找到 host sibling
	const sibling = getHostSibling(finishedWork)

	// 3、找到finishedWork 对应的DOM
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
	}
}

/**
 * 为了实现移动操作，需要支持parentNode.insertBefore
 * parentNode.insertBefore需要找到「目标兄弟Host节点」
 * 1、可能并不是目标fiber的直接兄弟节点
 * 情况1
 * <A/><B/>
 * function B() {
 * 		return <div/>;
 * }
 *
 * 情况2
 * <App/><div/>
 * function App() {
 * 		return <A/>;
 * }
 * 2、不稳定的Host节点不能作为「目标兄弟Host节点」即：此兄弟节点也被标记了Placement
 */
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber

	findSibling: while (true) {
		// 同级没有兄弟节点了 就往上找
		// 找到一个父节点 然后跳出while 重新寻找父节点的兄弟节点执行向下找的while
		while (node.sibling === null) {
			const parent = node.return
			// todo 为啥parent.tag === HostComponent 也是终止条件
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null
			}
			node = parent
		}
		// 往兄弟节点找
		node.sibling.return = node.return
		node = node.sibling

		// node 不是Host组件 就一直向下遍历
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 如果遇到不稳定的兄弟节点 直接跳出此循环 且重新执行外层 while
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling
			}

			if (node.child === null) {
				//	向下没有子节点了 就跳出此循环 重新执行外层 while 遍历下一个sibling
				continue findSibling
			} else {
				// 向下比那里
				node.child.return = node
				node = node.child
			}
		}

		//	找到一个稳定 且是Host组件的节点 就返回这个Host
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode
		}
	}
}

// 往上找到一个 Host DOM
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return

	while (parent) {
		const parentTag = parent.tag
		if (parentTag === HostComponent) {
			return parent.stateNode as Container
		}
		if (parentTag === HostRoot) {
			// HostRoot 是一个FiberRootNode
			// FiberRootNode 对应的DOM 存在于 container
			return (parent.stateNode as FiberRootNode).container
		}
		parent = parent.return
	}

	if (__DEV__) {
		console.warn('未找到host parent')
	}

	return null
}

/**
 * 递归向下的过程
 * 找到第一层Host 执行宿主环境的appendChild
 * 还需要把找到的第一个Host它的sibling一起添加到传入的hostParent
 */
function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	// 往下找到第一层 Host DOM
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before)
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode)
		}
		return
	}

	const child = finishedWork.child
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent)
		// 还需要把child 的sibling也一起append到hostParent
		let sibling = child.sibling
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}

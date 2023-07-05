import {FunctionComponent, HostComponent, HostRoot, HostText} from './workTags'
import {FiberNode, FiberRootNode} from './fiber'
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags'
import {
	appendChildToContainer,
	commitUpdate,
	Container,
	removeChild
} from 'hostConfig'

let nextEffect: FiberNode | null = null

// commit 阶段数据突变的副作用处理
export function commitMutationEffects(finishedWork: FiberNode) {
	nextEffect = finishedWork

	while (nextEffect !== null) {
		// 向下遍历 一直找到没有subtreeFlags的节点结束 再往上遍历
		const child: FiberNode | null = nextEffect.child

		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			//  存在MutationMask的subtreeFlags就赋值给nextEffect 继续往下
			nextEffect = child
		} else {
			/**
			 * 要么到叶子节点了，要么不包含substreeFlags
			 * 但是可能存在flags
			 *  向上遍历 DFS 深度优先遍历
			 */
			up: while (nextEffect !== null) {
				commitMutaitonEffectsOnFiber(nextEffect)
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

function commitMutaitonEffectsOnFiber(finishedWork: FiberNode) {
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
				commitChildDeletion(childToDeletion)
			})
		}
		// 执行完之后从workInProgress的flags中移除Update
		finishedWork.flags &= ~ChildDeletion
	}
}

function commitChildDeletion(childToDeletion: FiberNode) {
	/**
	 * 对于标记ChildDeletion的子树，由于子树中：
	 * 1、对于FC，需要处理useEffect unmout执行、解绑ref
	 * 2、对于HostComponent，需要解绑ref
	 * 3、对于子树的根HostComponent，才是需要移除的DOM
	 * 注意：所以需要实现「遍历ChildDeletion子树」的流程
	 * */
	let rootHostNode: FiberNode | null = null // 定义这颗子树的根节点

	// 1、递归子树
	commitNestedComponent(childToDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber
				}
				// 解绑ref
				return
			case HostText:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber
				}
				return
			case FunctionComponent:
				// 处理 useEffect unmount
				break
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber)
				}
		}
	})

	// 2、移除rootHostNode
	if (rootHostNode !== null) {
		const hostParent = getHostParent(childToDeletion)
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent)
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
	// 2、找到finishedWork 对应的DOM
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent)
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
function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// 往下找到第一层 Host DOM
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode)
		return
	}

	const child = finishedWork.child
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent)
		// 还需要把child 的sibling也一起append到hostParent
		let sibling = child.sibling
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}

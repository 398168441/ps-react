import {HostComponent, HostRoot, HostText} from './workTags'
import {FiberNode, FiberRootNode} from './fiber'
import {MutationMask, NoFlags, Placement} from './fiberFlags'
import {appendChildToContainer, Container} from 'hostConfig'

let nextEffect: FiberNode | null = null

export function commitMutationEffects(finishedWork: FiberNode) {
	nextEffect = finishedWork

	// 向下遍历 一直找到没有subtreeFlags的节点结束 再往上遍历
	const child: FiberNode | null = nextEffect.child

	while (nextEffect !== null) {
		if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child) {
			//  存在MutationMask的subtreeFlags就赋值给nextEffect 继续往下
			nextEffect = child
		} else {
			/**
			 * 要么到叶子节点了，要么不包含substreeFlags
			 * 但是可能存在flags
			 *  向上遍历 DFS 深度优先遍历
			 */
			up: while (nextEffect !== null) {
				// todo 执行操作
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
	// 判断flags中包含Placement的副作用 则执行插入操作
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		finishedWork.flags &= ~Placement
	}
	// flags 中 Update
	// flags 中 ChildDeletion
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
function getHostParent(finishedWork: FiberNode): Container | null {
	let parent = finishedWork.return

	while (parent !== null) {
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
		appendChildToContainer(finishedWork.stateNode, hostParent)
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

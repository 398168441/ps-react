import {ChildDeletion, Placement} from './fiberFlags'
import {HostText} from './workTags'
import {REACT_ELEMENT_TYPE} from 'shared/ReactSymbols'
import {Props, ReactElementType} from 'shared/ReactTypes'
import {createFiberFromElement, createWorkInProgress, FiberNode} from './fiber'

/**
 * 【重要】
 * diff算法
 */
function ChildReconciler(shouldTrackEffects: boolean) {
	// 删除旧的Fiber
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return
		}

		if (returnFiber.deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= ChildDeletion
		} else {
			// 在加入第一个child的时候已经标记了ChildDeletion
			returnFiber.deletions.push(childToDelete)
		}
	}

	//	删除sibling节点
	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		// 不需要追踪副作用 直接return
		if (!shouldTrackEffects) {
			return
		}
		let childToDelete = currentFirstChild
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete)
			childToDelete = childToDelete.sibling
		}
	}

	// 创建单个节点的 Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		/**
		 *
		 * 1、比较是否可以复用current fiber
		 *    比较key，如果key【不同】，不能复用
		 *    比较type，如果type【不同】，不能复用
		 *    如果key与type都【相同】，则可复用
		 * 2、不能复用，则创建新的（同mount流程），可以复用则复用旧的
		 * 3、注意：对于同一个fiberNode，即使反复更新，current、wip这两个fiberNode会重复使用
		 */
		const {key, type} = element
		while (currentFiber !== null) {
			// update 阶段
			if (currentFiber.key === key) {
				// 比较完可以 再比较type
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					// 先判断element是一个有效的ReactElement
					if (currentFiber.type === type) {
						/**
						 * key 相同 type相同则可复用 === 复用当前节点
						 * 例如：A1B2C3 -> A1
						 */
						const existing = useFiber(currentFiber, element.props)
						// 复用后把return指向父节点
						existing.return = returnFiber
						/**
						 * 当前Fiber可复用，则需要标记其他sibling节点为删除
						 * 当前节点可复用，则把currentFiber.sibling传进去
						 * 即：A1可复用，B2 C3 均标记删除
						 */
						deleteRemainingChildren(returnFiber, currentFiber.sibling)
						return existing
					}
					/**
					 * key相同 type不同 === 不存在任何可复用的可能性
					 * 例如：A1B2C3 -> B1 存在key相同，但是type变了
					 * 则要删除所有旧的 A1B2C3 然后走最下面mount一样的流程创建新的Fiber
					 */
					deleteRemainingChildren(returnFiber, currentFiber)
					break
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
						break
					}
				}
			} else {
				// 删除掉旧的Fiber 还是走最下面mount一样的流程创建新的Fiber
				/**
				 * key不同，则先删除当前节点，继续遍历剩余的sibling
				 * 则需要把currentFiber.sibling赋值给currentFiber
				 * 如果都没有可以复用的currenFiber就为null 跳出while 走下面创建新的Fiber
				 */
				deleteChild(returnFiber, currentFiber)
				currentFiber = currentFiber.sibling
			}
		}

		// 根据element创建一个Fiber
		const fiber = createFiberFromElement(element)
		fiber.return = returnFiber
		return fiber
	}

	//  创建单个文本节点的Fiber
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string
	) {
		// 判断
		while (currentFiber !== null) {
			// update 阶段
			/**
			 * 进入reconcileSingleTextNode newChild是string or number
			 * 所以判断currentFiber是否是HostText
			 * 是HostText则复用 更新下content
			 */
			if (currentFiber.tag === HostText) {
				//	类型没变 可以复用 修改下content
				const existing = useFiber(currentFiber, {content})
				existing.return = returnFiber
				// 复用后 其他sibling标记为删除
				deleteRemainingChildren(returnFiber, currentFiber.sibling)
				return existing
			}
			/**
			 * 不是HostText，则先删除当前Fiber 再遍历sibling
			 * 找到能复用的就在上一个判断复用
			 * 没找到就把所有旧Fiber标记删除 跳出while循环 走最下面创建新Fiber
			 */
			deleteChild(returnFiber, currentFiber)
			currentFiber = currentFiber.sibling
		}

		// mount阶段 直接创建新的Fiber
		const fiber = new FiberNode(HostText, {content}, null)
		fiber.return = returnFiber
		return fiber
	}

	//  添加Placement副作用
	function placeSingleChild(fiber: FiberNode) {
		//  应该追踪副作用且首屏渲染
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement
		}
		return fiber
	}

	// 生成子Fiber函数
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		//  判断当前需要创建的fiber的类型

		//  REACT_ELEMENT_TYPE
		if (typeof newChild === 'object' && newChild !== null) {
			// 1、单节点 (更新后newChild是单节点)
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					)
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild)
					}
					break
			}

			// 2、多节点
		}

		//  2、多节点 ul>li*3

		//  3、文本节点
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			//
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		// 兜底 直接删除 稳当点
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild)
		}

		return null
	}
}

// 复用Fiber
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps)
	clone.index = 0
	clone.sibling = null
	return clone
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

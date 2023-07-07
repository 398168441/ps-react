import {ChildDeletion, Placement} from './fiberFlags'
import {Fragment, HostText} from './workTags'
import {REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE} from 'shared/ReactSymbols'
import {Key, Props, ReactElementType} from 'shared/ReactTypes'
import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress,
	FiberNode
} from './fiber'

type ExistingChildren = Map<string | number, FiberNode>

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

	//  创建单个节点的 Fiber
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
						let props = element.props
						// TODO 没搞懂
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children
						}
						/**
						 * key 相同 type相同则可复用 === 复用当前节点
						 * 例如：A1B2C3 -> A1
						 */
						const existing = useFiber(currentFiber, props)
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
		let fiber
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key)
		} else {
			fiber = createFiberFromElement(element)
		}
		fiber.return = returnFiber
		return fiber
	}

	//  创建单个文本节点的Fiber
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
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

	//	需要创建的Fiber即newChild 是Array的情况
	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		//	最后一个可复用的Fiber在current中的index
		let lastPlacedIndex = 0
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null
		// 创建的第一个fiber
		let firstNewFiber: FiberNode | null = null

		// 1、把currentFiber及兄弟节点保存在一个Map中
		const existingChildren: ExistingChildren = new Map()
		let current = currentFirstChild
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index
			existingChildren.set(keyToUse, current)
			current = current.sibling
		}

		/**
		 * 遍历newChild
		 * 根据newChild中每一项的key，从Map即existingChildren中获取currentFiber
		 * 如果获取不到 则没有复用的可能
		 */
		for (let i = 0; i < newChild.length; i++) {
			// 2、遍历newChild,从Map中寻找是否可复用
			const after = newChild[i]
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after)

			if (newFiber === null) {
				continue
			}

			// 3、标记移动还是插入
			/**
			 * A1 B2 C3 -> B2 C3 A1
			 * 0__1__2______0__1__2
			 * ① 当遍历element时，「当前遍历到的element」一定是「所有已遍历的element」中最靠右那个
			 * ② 所以只需要记录「最后一个可复用fiber」在current中的index（lastPlacedIndex），在接下来的遍历中：
			 *   -如果接下来遍历到的「可复用fiber」的index < lastPlacedIndex，则标记Placement
			 *   -否则，不标记
			 */
			newFiber.index = i
			newFiber.return = returnFiber

			//	lastNewFiber 始终从i到最大的i，即指向最后一个newFiber
			if (lastNewFiber === null) {
				lastNewFiber = newFiber
				firstNewFiber = newFiber
			} else {
				/**
				 * 当lastNewFiber不为null 则把lastNewFiber指向下一个newFiber
				 * 先把lastNewFiber.sibling指向新的newFiber 再把lastNewFiber指向lastNewFiber.sibling
				 * 这样lastNewFiber始终指向最后一个newFiber
				 */
				lastNewFiber.sibling = newFiber
				lastNewFiber = lastNewFiber.sibling
			}

			if (!shouldTrackEffects) {
				continue
			}

			const current = newFiber.alternate
			//	这里判断current 其实就是判断是否复用了 复用的才有alternate
			if (current !== null) {
				const oldIndex = current.index
				if (oldIndex < lastPlacedIndex) {
					/**
					 * newFiber对应在旧的Fiber中的index 小于最后一个可复用的newFiber在旧的Fiber中的index(lastPlacedIndex)
					 * 即 newFiber1 相比于前一个 newFiber2 在旧的兄弟关系中 newFiber1是在前面的 所以在生成新的的时候复用了 就需要标记移动
					 * 则在新的Fiber中 需要移动此Fiber的位置
					 */
					newFiber.flags |= Placement
					continue
				} else {
					// 不移动 则更新下lastPlacedIndex
					// 始终保持 lastPlacedIndex为 【最后一个可复用fiber】在current中的index
					lastPlacedIndex = oldIndex
				}
			} else {
				// mount
				newFiber.flags |= Placement
			}
		}

		// 4、将Map中剩余的不可复用的标记删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber)
		})

		//	最终再返回第一个newFiber
		return firstNewFiber
	}

	//	用来判断Map中的Fiber是否可复用
	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index
		const before = existingChildren.get(keyToUse)

		//	1、element是HostText 则需要判断before是怎样
		if (typeof element === 'string' || typeof element === 'number') {
			/**
			 * 如果before存在且tag是HostText 则可以复用
			 * 可以复用则需从Map中移除
			 */
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse)
					return useFiber(before, {content: element + ''})
				}
			}
			//	before不存在或者不是HostText则new一个新的FiberNode
			return new FiberNode(HostText, {content: element + ''}, null)
		}

		// 2、element是ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					// 判断Fragment
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						)
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse)
							return useFiber(before, element.props)
						}
					}
					return createFiberFromElement(element)
					break
			}

			if (Array.isArray(element)) {
				return updateFragment(
					returnFiber,
					before,
					element,
					keyToUse,
					existingChildren
				)
			}
		}

		return null
	}

	// 生成子Fiber函数
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) {
		//  判断当前需要创建的fiber的类型
		// 判断Fragment
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null
		if (isUnkeyedTopLevelFragment) {
			/**
			 * isUnkeyedTopLevelFragment 对应以下这种情况
			 * <>
			 * 	<div></div>
			 * 	<div></div>
			 * </>
			 *
			 *  对应DOM
			 * <div></div>
			 * <div></div>
			 *
			 * 对应jsx
			 * jsxs(Fragment, {
			 * 	children: [
			 * 		jsx("div", {}),
			 * 		jsx("div", {})
			 * 	]
			 * });
			 * 真的newChild就是这个newChild的props下的children
			 * 真的newChild是Array、string/number、$$typeof是REACT_ELEMENT_TYPE 就会走下面的逻辑
			 */
			newChild = newChild.props.children
		}

		//  REACT_ELEMENT_TYPE
		if (typeof newChild === 'object' && newChild !== null) {
			// 2、多节点 (更新后newChild是多节点)
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild)
			}
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
		}

		//  3、文本节点
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			//
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		// 兜底 直接删除 稳当点
		if (currentFiber !== null) {
			deleteRemainingChildren(returnFiber, currentFiber)
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

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key)
	} else {
		// 复用
		existingChildren.delete(key)
		fiber = useFiber(current, elements)
	}
	fiber.return = returnFiber
	return fiber
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	const [num, updateNum] = useState(100)
	// @ts-ignore
	window.updateNum = updateNum
	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>]
	return (
		<ul
			onClick={() => {
				updateNum((num) => num + 1)
				updateNum((num) => num + 1)
				updateNum((num) => num + 1)
			}}
		>
			<>
				<li>1</li>
				<li>2</li>
			</>
			<li>3</li>
			<li>4</li>
			{num}
		</ul>
	)
}

const Child = () => {
	return (
		<div>
			<span>ps-react</span>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)

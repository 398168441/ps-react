import React, {useState, useEffect, useRef} from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [num, updateNum] = useState(100)

	useEffect(() => {
		console.log('===App===create==')
		return () => {
			console.log('===App===destroy==')
		}
	}, [num])

	return (
		<div>
			<div
				onClick={() => {
					updateNum(10)
				}}
			>
				app~{num}
			</div>
			{num === 100 && <Child />}
		</div>
	)
}

function Child() {
	useEffect(() => {
		console.log('===Child===create==')
		return () => {
			console.log('===Child===destroy==')
		}
	}, [])
	return (
		<div>
			Child
			<Son />
		</div>
	)
}

function Son() {
	useEffect(() => {
		console.log('===Son===create==')
		return () => {
			console.log('===Son===destroy==')
		}
	}, [])
	return <div>Son</div>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)

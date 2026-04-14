/* =========================================================================
   ESTRUCTURAS DE DATOS AVANZADAS EN MEMORIA (Para Fines Académicos y Rendimiento)
   ========================================================================= */

/**
 * 1. TRIE (ÁRBOL DE PREFIJOS)
 * Uso: Búsqueda ultra-rápida y autocompletado de productos (Helados) en el Punto de Venta (POS).
 * Complejidad de Búsqueda: O(m) donde 'm' es la longitud del término buscado.
 * Beneficio: Infinitamente más rápido que hacer Array.filter() o LIKE '%termino%' en SQL para uso en RAM.
 */
class TrieNode {
    constructor() {
        this.children = {}; // Hash map de nodos hijos
        this.isEndOfWord = false;
        this.itemData = null; // Almacenará el objeto helado completo al final de la palabra
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word, data) {
        let node = this.root;
        const normalizedWord = word.toLowerCase().trim();
        for (let char of normalizedWord) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEndOfWord = true;
        node.itemData = data;
    }

    // Retorna todos los items que comiencen con el prefijo dado O(m + k)
    searchPrefix(prefix) {
        let node = this.root;
        const normalizedPrefix = prefix.toLowerCase().trim();
        for (let char of normalizedPrefix) {
            if (!node.children[char]) return []; // No match
            node = node.children[char];
        }
        return this._collectAllWords(node, []);
    }

    _collectAllWords(node, results) {
        if (node.isEndOfWord && node.itemData) {
            results.push(node.itemData);
        }
        for (let char in node.children) {
            this._collectAllWords(node.children[char], results);
        }
        return results;
    }

    // Carga inicial masiva desde la BD
    buildFromDataset(dataset) {
        this.root = new TrieNode(); // Limpiar
        for (let item of dataset) {
            this.insert(item.nombre, item);
        }
    }
}

/**
 * 2. COLA DE PRIORIDAD (BASED ON MIN-HEAP)
 * Uso: Organizar las Reservas entrantes. 
 * Complejidad: Extraer reserva urgente (Pop) O(log N). Inserción O(log N).
 * Beneficio: No se necesita reordenar toda una lista masiva cada vez que entra una reserva (O(N log N)).
 */
class PriorityQueueHeap {
    constructor() {
        this.heap = [];
    }

    _getParentIndex(i) { return Math.floor((i - 1) / 2); }
    _getLeftChildIndex(i) { return 2 * i + 1; }
    _getRightChildIndex(i) { return 2 * i + 2; }
    _swap(i, j) {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;
    }

    // Insertar reserva priorizando por fecha_reserva (Timestamp) O(log N)
    enqueue(reserva) {
        this.heap.push(reserva);
        this._heapifyUp(this.heap.length - 1);
    }

    // Extraer la reserva más urgente O(log N)
    dequeue() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        
        const root = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._heapifyDown(0);
        return root;
    }

    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    _heapifyUp(index) {
        let currentIndex = index;
        while (currentIndex > 0) {
            let parentIndex = this._getParentIndex(currentIndex);
            // Comparamos prioridades (mientras menor es el timestamp UNIX, más urge)
            if (new Date(this.heap[currentIndex].fecha_reserva).getTime() < new Date(this.heap[parentIndex].fecha_reserva).getTime()) {
                this._swap(currentIndex, parentIndex);
                currentIndex = parentIndex;
            } else {
                break;
            }
        }
    }

    _heapifyDown(index) {
        let currentIndex = index;
        while (this._getLeftChildIndex(currentIndex) < this.heap.length) {
            let smallestChildIndex = this._getLeftChildIndex(currentIndex);
            let rightChildIndex = this._getRightChildIndex(currentIndex);

            if (rightChildIndex < this.heap.length && 
                new Date(this.heap[rightChildIndex].fecha_reserva).getTime() < new Date(this.heap[smallestChildIndex].fecha_reserva).getTime()) {
                smallestChildIndex = rightChildIndex;
            }

            if (new Date(this.heap[smallestChildIndex].fecha_reserva).getTime() < new Date(this.heap[currentIndex].fecha_reserva).getTime()) {
                this._swap(currentIndex, smallestChildIndex);
                currentIndex = smallestChildIndex;
            } else {
                break;
            }
        }
    }

    // Reconstruir Heap desde BD
    buildFromDataset(dataset) {
        this.heap = [];
        for (let res of dataset) {
            this.enqueue(res);
        }
    }
    
    // Convertir a Array estático para visualizar O(N)
    toArray() { return [...this.heap]; }
}

/**
 * 3. COLA ESTÁNDAR (FIFO QUEUE) usando Nodos Enlazados
 * Uso: Flujo continuo de Pedidos (Cocina/Preparación). Primer pedido en entrar, primero en salir.
 * Complejidad: O(1) Push y Shift.
 * Beneficio: A diferencia de Array.shift() que es O(N), esta Lista Enlazada Simples extrae e inserta en tiempo constante O(1).
 */
class NodeQueue {
    constructor(data) {
        this.data = data;
        this.next = null;
    }
}

class LinkedListQueue {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    // Encolar (Push O(1))
    enqueue(data) {
        const newNode = new NodeQueue(data);
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.length++;
    }

    // Desencolar (Shift O(1))
    dequeue() {
        if (!this.head) return null;
        const temp = this.head;
        this.head = this.head.next;
        if (!this.head) this.tail = null;
        this.length--;
        return temp.data;
    }

    peek() { return this.head ? this.head.data : null; }
    
    isEmpty() { return this.length === 0; }
    
    // Utilidad: Iterar colas para mandar por WebSocket
    toArray() {
        let arr = [];
        let cur = this.head;
        while(cur) {
            arr.push(cur.data);
            cur = cur.next;
        }
        return arr;
    }
}

// Instancias Globales para mantener estado en RAM Node.js
const heladosTrie = new Trie();
const reservasHeap = new PriorityQueueHeap();
const pedidosQueue = new LinkedListQueue();

module.exports = {
    Trie,
    PriorityQueueHeap,
    LinkedListQueue,
    heladosTrie,
    reservasHeap,
    pedidosQueue
};
